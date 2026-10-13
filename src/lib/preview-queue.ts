import "server-only";
import { prisma } from "@/lib/prisma";
import { convertToPdf, detectEngine } from "@/lib/conversion";
import { getOriginalPath, writePreview, ensureUploadDirs } from "@/lib/storage";
import { isSafeStoredName, deletePreview } from "@/lib/storage";

/**
 * Conversions run in the background so that opening a material page is always
 * instant and a 45 MB deck never blocks a request. Job state lives in the
 * database, so a server restart mid-conversion is recoverable rather than lost.
 *
 * A small in-process queue caps how many conversions run at once: LibreOffice
 * is CPU and memory hungry, and a shared university server should not be
 * saturated by a few simultaneous requests.
 */
const MAX_CONCURRENT = 2;

type QueueState = {
  running: number;
  queued: string[];
  drainTimer: NodeJS.Timeout | null;
};

const globalForQueue = globalThis as unknown as { __previewQueue?: QueueState };

const state: QueueState = (globalForQueue.__previewQueue ??= {
  running: 0,
  queued: [],
  drainTimer: null,
});

async function processJob(jobId: string): Promise<void> {
  const job = await prisma.previewJob.findUnique({
    where: { id: jobId },
    include: { material: true },
  });
  if (!job || job.status === "DONE") return;

  const material = job.material;

  // Clear a previous attempt so a retry starts from a clean slate.
  if (material.previewPath) {
    await deletePreview(material.previewPath).catch(() => {});
  }

  await prisma.previewJob.update({
    where: { id: jobId },
    data: { status: "RUNNING", attempts: { increment: 1 }, error: null },
  });
  await prisma.material.update({
    where: { id: material.id },
    data: { previewStatus: "RUNNING", previewError: null, previewPath: null },
  });

  try {
    if (!isSafeStoredName(material.storedName)) {
      throw new Error("Stored file name is not valid");
    }
    if (!(await detectEngine())) {
      throw new Error(
        "No conversion engine available. Install LibreOffice to enable previews for PowerPoint, Word and Excel files.",
      );
    }

    await ensureUploadDirs();
    const result = await convertToPdf(
      getOriginalPath(material.storedName),
      material.extension,
      jobId,
    );

    const previewName = await writePreview(result.pdf);

    await prisma.material.update({
      where: { id: material.id },
      data: {
        previewStatus: "READY",
        previewPath: previewName,
        previewEngine: result.engine,
        previewError: null,
      },
    });
    await prisma.previewJob.update({
      where: { id: jobId },
      data: { status: "DONE", engine: result.engine, error: null },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Preview conversion failed";

    await prisma.material.update({
      where: { id: material.id },
      data: { previewStatus: "FAILED", previewPath: null, previewError: message },
    });
    await prisma.previewJob.update({
      where: { id: jobId },
      data: { status: "FAILED", error: message },
    });
  }
}

async function drain(): Promise<void> {
  while (state.running < MAX_CONCURRENT && state.queued.length > 0) {
    const next = state.queued.shift();
    if (!next) break;
    state.running += 1;
    void processJob(next)
      .catch(() => {
        // processJob records its own failures; nothing to add here.
      })
      .finally(() => {
        state.running -= 1;
        void drain();
      });
  }
}

/**
 * Creates a job for a material and schedules it. Returns immediately.
 * Re-requesting a preview that is already queued or running is a no-op.
 */
export async function enqueuePreview(materialId: string): Promise<void> {
  const existing = await prisma.previewJob.findFirst({
    where: {
      materialId,
      status: { in: ["PENDING", "RUNNING"] },
    },
    orderBy: { createdAt: "desc" },
  });
  if (existing) {
    if (!state.queued.includes(existing.id) && existing.status === "PENDING") {
      state.queued.push(existing.id);
    }
    void drain();
    return;
  }

  const job = await prisma.previewJob.create({
    data: { materialId, status: "PENDING" },
  });
  await prisma.material.update({
    where: { id: materialId },
    data: { previewStatus: "PENDING", previewError: null },
  });

  state.queued.push(job.id);
  void drain();
}

/**
 * Called once at server start. Any job left RUNNING by a previous process died
 * with that process, so it is put back in the queue.
 */
export async function recoverStaleJobs(): Promise<void> {
  const stale = await prisma.previewJob.findMany({
    where: { status: "RUNNING" },
    select: { id: true, materialId: true },
  });
  if (stale.length === 0) return;

  await prisma.previewJob.updateMany({
    where: { status: "RUNNING" },
    data: { status: "PENDING" },
  });
  await prisma.material.updateMany({
    where: { previewStatus: "RUNNING" },
    data: { previewStatus: "PENDING" },
  });

  for (const job of stale) state.queued.push(job.id);
  void drain();
}

export function queueDepth(): { running: number; queued: number } {
  return { running: state.running, queued: state.queued.length };
}
