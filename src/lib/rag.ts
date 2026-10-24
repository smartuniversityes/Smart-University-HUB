import "server-only";
import { prisma } from "@/lib/prisma";
import { embedText } from "@/lib/gemini";
import { decodeEmbedding } from "@/lib/embeddings";
import { SITE_NAME } from "@/lib/site";

/**
 * Retrieval for the study chatbot: embed the student's question, score every
 * indexed chunk by cosine similarity and return the best excerpts together
 * with the material metadata needed to cite them.
 *
 * SQLite has no vector index, so the whole (few thousand at most) chunk set is
 * scored in process. Vectors are cached in memory for a minute because most
 * questions arrive one after another in the same conversation and re-decoding
 * the same Float32 buffers on every message is pure waste.
 */

/** How many excerpts are handed to the model as context. */
const TOP_K = 6;
/** Scoped chat sees one document, so give the model more of it (e.g. a full slide deck). */
const SCOPED_TOP_K = 12;
/** Caps excerpts per material so one long document cannot crowd out the rest. */
const PER_MATERIAL_CAP = 3;
/** When scoped to a single material, allow more excerpts from it to avoid missing content. */
const SCOPED_PER_MATERIAL_CAP = 12;
/** Drop very weak matches to avoid showing unrelated sources. */
const MIN_SCORE = 0.15;

export type RetrievedChunk = {
  id: string;
  materialId: string;
  content: string;
  pageLabel: string | null;
  title: string;
  extension: string;
  subjectCode: string;
  subjectName: string;
  score: number;
};

type CachedRow = {
  id: string;
  materialId: string;
  content: string;
  pageLabel: string | null;
  title: string;
  extension: string;
  subjectCode: string;
  subjectName: string;
  vector: Float32Array;
};

type ChunkCache = { rows: CachedRow[]; cachedAt: number };

const CACHE_TTL_MS = 60_000;

const globalForCache = globalThis as unknown as { __ragCache?: ChunkCache | null };

async function loadRows(): Promise<CachedRow[]> {
  const cached = globalForCache.__ragCache;
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) return cached.rows;

  // Only chunks whose material finished indexing are searchable; a material
  // mid-re-index keeps its old chunks, so the index is never empty mid-swap.
  const chunks = await prisma.documentChunk.findMany({
    where: { material: { indexStatus: "READY" } },
    select: {
      id: true,
      materialId: true,
      content: true,
      pageLabel: true,
      embedding: true,
      material: {
        select: {
          title: true,
          extension: true,
          subject: { select: { code: true, name: true } },
        },
      },
    },
  });

  const rows: CachedRow[] = chunks.map((chunk) => ({
    id: chunk.id,
    materialId: chunk.materialId,
    content: chunk.content,
    pageLabel: chunk.pageLabel,
    title: chunk.material.title,
    extension: chunk.material.extension,
    subjectCode: chunk.material.subject.code,
    subjectName: chunk.material.subject.name,
    vector: decodeEmbedding(Buffer.from(chunk.embedding)),
  }));

  globalForCache.__ragCache = { rows, cachedAt: Date.now() };
  return rows;
}

/** Drops the cached vectors; called after an indexing run changes the data. */
export function invalidateChunkCache(): void {
  globalForCache.__ragCache = null;
}

function cosine(a: Float32Array, b: Float32Array): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Finds the excerpts most relevant to a question. Returns them ranked best
 * first; the numbering the model cites with is the order of this array.
 * Pass `materialId` to search inside one material only (the "Ask AI" button on
 * a material page uses this so answers stay about that file).
 */
export async function retrieve(query: string, materialId?: string): Promise<RetrievedChunk[]> {
  let rows = await loadRows();
  if (rows.length === 0) return [];

  const scoped = Boolean(materialId);
  if (materialId) {
    rows = rows.filter((row) => row.materialId === materialId);
    if (rows.length === 0) return [];
  }

  const queryVector = new Float32Array(await embedText(query));

  const scored = rows.map((row) => ({
    row,
    score: cosine(queryVector, row.vector),
  }));
  scored.sort((a, b) => b.score - a.score);

  const seen = new Map<string, number>();
  const picked: RetrievedChunk[] = [];
  const perMaterialCap = scoped ? SCOPED_PER_MATERIAL_CAP : PER_MATERIAL_CAP;
  const topK = scoped ? SCOPED_TOP_K : TOP_K;

  for (const { row, score } of scored) {
    if (picked.length >= topK) break;
    if (score < MIN_SCORE) continue;
    const perMaterial = seen.get(row.materialId) ?? 0;
    if (perMaterial >= perMaterialCap) continue;
    seen.set(row.materialId, perMaterial + 1);

    picked.push({
      id: row.id,
      materialId: row.materialId,
      content: row.content,
      pageLabel: row.pageLabel,
      title: row.title,
      extension: row.extension,
      subjectCode: row.subjectCode,
      subjectName: row.subjectName,
      score,
    });
  }

  return picked;
}

/** True when nothing at all has been indexed yet (fresh install, no uploads). */
export async function hasAnyIndexedChunks(): Promise<boolean> {
  const rows = await loadRows();
  return rows.length > 0;
}

export function buildSystemPrompt(chunks: RetrievedChunk[], scoped = false): string {
  const excerpts = chunks
    .map((chunk, index) => {
      const source = `[${index + 1}] "${chunk.title}" — ${chunk.subjectCode} ${chunk.subjectName} (${
        chunk.pageLabel ?? chunk.extension.toUpperCase()
      })`;
      return `${source}\n"""${chunk.content}"""`;
    })
    .join("\n\n");

  const scopeNote = scoped
    ? chunks.length > 0
      ? "\nThe student asked about one specific file, and only excerpts from that file are given below. Stay on that topic; if it is not covered there, say so and point them to the other subjects in the hub.\n"
      : "\nThe student asked about one specific file, but its text has not been indexed yet (possibly still processing, or it is a scan). Explain that you cannot read this file yet and suggest they ask a broader question instead.\n"
    : "";

  return `You are the study assistant of ${SITE_NAME}'s material hub. Students ask questions about their course lectures.

Answer using ONLY the numbered excerpts below. Treat them as the source of truth.
${scopeNote}
Rules:
- Cite sources inline with their bracket numbers, e.g. "Mehnat karo [1]" or "as defined here [2][3]". Never invent numbers that are not in the list.
- If the excerpts do not contain the answer, say plainly that the uploaded material does not cover it, and suggest which subject or topic the student should look under. Never guess or make up facts, dates, formulas or definitions.
- Match the student's language exactly: if they write in English answer in English, in Urdu answer in اردو, in Roman Urdu answer in Roman Urdu. Keep technical terms in the form the lecture material uses them.
- Be concise and student-friendly: short paragraphs or bullets, no filler, no marketing tone.
- If asked for a summary, organise it by topic and keep references attached to each point.

Excerpts:
${excerpts || "(none)"}`;
}
