import "server-only";
import { prisma } from "@/lib/prisma";
import { embedTexts } from "@/lib/gemini";
import { encodeEmbedding } from "@/lib/embeddings";
import { invalidateChunkCache } from "@/lib/rag";
import { extractText, ExtractionError, type ExtractedPiece } from "@/lib/text-extract";

/**
 * Background indexing: the material's text is extracted, split into chunks,
 * embedded with Gemini and stored so the chatbot can retrieve it later.
 *
 * Like the preview queue this is an in-process queue, but the work per item is
 * one extraction plus a handful of batched embedding calls, so a single worker
 * keeps the API within the free tier and never saturates the machine.
 */

const MAX_CONCURRENT = 1;
/** Chunks per embedding API call; batching keeps the request count low. */
const EMBED_BATCH = 20;
/** Target chunk size in characters, ~300-400 tokens. */
const CHUNK_CHARS = 1400;
/** Overlap so a definition split across a boundary is still retrievable. */
const CHUNK_OVERLAP = 200;

type QueueState = {
  running: number;
  queued: string[];
  /** Ids currently being indexed, so a re-enqueue cannot double-start one. */
  activeIds: Set<string>;
};

const globalForQueue = globalThis as unknown as { __indexQueue?: QueueState };

const state: QueueState = (globalForQueue.__indexQueue ??= {
  running: 0,
  queued: [],
  activeIds: new Set<string>(),
});
const { activeIds } = state;

/* ------------------------------------------------------------------ *
 * Chunking
 * ------------------------------------------------------------------ */

export type ChunkDraft = { pageLabel: string | null; content: string };

/**
 * Splits extracted pieces into overlapping chunks. Pieces already smaller than
 * the target (a slide, a page of notes) stay whole, because a citation to
 * "Slide 4" is only useful if the chunk is exactly slide 4.
 */
export function chunkPieces(pieces: ExtractedPiece[]): ChunkDraft[] {
  const chunks: ChunkDraft[] = [];

  for (const piece of pieces) {
    const text = piece.text.trim();
    if (text.length === 0) continue;

    if (text.length <= CHUNK_CHARS) {
      chunks.push({ pageLabel: piece.label, content: text });
      continue;
    }

    // Long pieces are split on paragraph boundaries where possible, then on
    // sentence boundaries, with overlap carried between chunks.
    const paragraphs = text.split(/\n{2,}/);
    let buffer = "";

    const flush = () => {
      const content = buffer.trim();
      if (content.length > 0) {
        chunks.push({ pageLabel: piece.label, content });
      }
      buffer = "";
    };

    for (const paragraph of paragraphs) {
      if (buffer.length + paragraph.length + 1 > CHUNK_CHARS && buffer.length > 0) {
        const overlapStart = Math.max(0, buffer.length - CHUNK_OVERLAP);
        const tail = buffer.slice(overlapStart);
        flush();
        buffer = tail.length < CHUNK_OVERLAP ? "" : tail;
      }

      if (paragraph.length > CHUNK_CHARS) {
        // A single giant paragraph: split on sentences.
        for (const sentence of paragraph.match(/[^.!?\n]+[.!?\n]*/g) ?? [paragraph]) {
          if (buffer.length + sentence.length > CHUNK_CHARS && buffer.length > 0) {
            flush();
          }
          buffer += sentence;
        }
      } else {
        buffer += (buffer.length > 0 ? "\n" : "") + paragraph;
      }
    }
    flush();
  }

  return chunks;
}

/* ------------------------------------------------------------------ *
 * Embedding storage (see @/lib/embeddings for the byte-level helpers)
 * ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ *
 * Indexing one material
 * ------------------------------------------------------------------ */

/** Indexes a single material now. Safe to call directly (admin re-index). */
export async function indexMaterial(materialId: string): Promise<void> {
  const material = await prisma.material.findUnique({ where: { id: materialId } });
  if (!material) return;

  await prisma.material.update({
    where: { id: material.id },
    data: { indexStatus: "RUNNING", indexError: null },
  });

  try {
    const pieces = await extractText(
      material.storedName,
      material.extension,
      material.previewPath,
    );
    const drafts = chunkPieces(pieces);

    if (drafts.length === 0) {
      throw new ExtractionError(
        "No readable text found in this file (it may be a scan or an empty upload).",
      );
    }

    const vectors: number[][] = [];
    for (let offset = 0; offset < drafts.length; offset += EMBED_BATCH) {
      const batch = drafts.slice(offset, offset + EMBED_BATCH);
      vectors.push(
        ...(await embedTexts(
          batch.map((chunk) =>
            chunk.pageLabel ? `${chunk.pageLabel}\n${chunk.content}` : chunk.content,
          ),
        )),
      );
    }

    // Swap the old chunks only after the new ones are fully ready, so a failed
    // re-index never leaves the material unsearchable.
    await prisma.$transaction([
      prisma.documentChunk.deleteMany({ where: { materialId: material.id } }),
      prisma.documentChunk.createMany({
        data: drafts.map((chunk, index) => ({
          materialId: material.id,
          chunkIndex: index,
          pageLabel: chunk.pageLabel,
          content: chunk.content,
          embedding: encodeEmbedding(vectors[index]),
        })),
      }),
      prisma.material.update({
        where: { id: material.id },
        data: { indexStatus: "READY", indexError: null, indexedAt: new Date() },
      }),
    ]);

    // Fresh chunks must be visible to the next question.
    invalidateChunkCache();
  } catch (error) {
    const message =
      error instanceof ExtractionError
        ? error.message
        : error instanceof Error
          ? error.message
          : "Indexing failed";
    await prisma.material.update({
      where: { id: material.id },
      data: { indexStatus: "FAILED", indexError: message },
    });
  }
}

/* ------------------------------------------------------------------ *
 * Queue
 * ------------------------------------------------------------------ */

async function drain(): Promise<void> {
  while (state.running < MAX_CONCURRENT && state.queued.length > 0) {
    const materialId = state.queued.shift();
    if (!materialId) break;
    state.running += 1;
    activeIds.add(materialId);
    void indexMaterial(materialId)
      .catch(() => {
        // indexMaterial records its own failures.
      })
      .finally(() => {
        state.running -= 1;
        activeIds.delete(materialId);
        void drain();
      });
  }
}

/** Schedules indexing for a material. Returns immediately. */
export async function enqueueIndexing(materialId: string): Promise<void> {
  if (state.queued.includes(materialId) || activeIds.has(materialId)) return;

  await prisma.material.updateMany({
    where: { id: materialId, indexStatus: { not: "RUNNING" } },
    data: { indexStatus: "PENDING" },
  });

  state.queued.push(materialId);
  void drain();
}

/**
 * Called at server start: indexes every material that was never indexed and
 * re-queues anything a previous process left mid-run.
 */
export async function recoverStaleIndexing(): Promise<void> {
  const stale = await prisma.material.findMany({
    where: { indexStatus: { in: ["RUNNING", "PENDING"] } },
    select: { id: true },
  });

  // Sample rows from the seed script have no real file on disk, so only
  // materials with a real stored file are picked up for a first-time index.
  const unindexed = await prisma.material.findMany({
    where: {
      indexStatus: "NONE",
      sizeBytes: { gt: 0 },
      storedName: { not: { startsWith: "sample-" } },
    },
    select: { id: true },
  });

  for (const material of [...stale, ...unindexed]) {
    if (!state.queued.includes(material.id) && !activeIds.has(material.id)) {
      state.queued.push(material.id);
    }
  }

  void drain();
}

/**
 * Admin "rebuild the AI index" button: queues every real file again, so the
 * chatbot picks up changes after a restore or a schema/extractor fix.
 * Returns how many materials were queued.
 */
export async function reindexAllMaterials(): Promise<number> {
  const materials = await prisma.material.findMany({
    where: {
      sizeBytes: { gt: 0 },
      storedName: { not: { startsWith: "sample-" } },
    },
    select: { id: true },
  });

  let queued = 0;
  for (const material of materials) {
    if (state.queued.includes(material.id) || activeIds.has(material.id)) continue;
    state.queued.push(material.id);
    queued += 1;
  }

  await prisma.material.updateMany({
    where: { id: { in: materials.map((material) => material.id) }, indexStatus: { not: "RUNNING" } },
    data: { indexStatus: "PENDING", indexError: null },
  });

  if (queued > 0) void drain();
  return queued;
}

export function indexQueueDepth(): { running: number; queued: number } {
  return { running: state.running, queued: state.queued.length };
}
