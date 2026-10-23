import "server-only";

import { prisma } from "@/lib/prisma";
import { queueDepth } from "@/lib/preview-queue";
import { indexQueueDepth } from "@/lib/index-queue";

/** Everything the admin dashboard renders, in one model call. */
export async function getDashboardStats() {
  const [
    userCount,
    professorCount,
    studentCount,
    materialCount,
    subjectCount,
    downloadCount,
    storageBytes,
    failedPreviews,
    runningJobs,
    indexedCount,
    failedIndexes,
    chunkCount,
    topMaterials,
    topProfessors,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { role: "PROFESSOR" } }),
    prisma.user.count({ where: { role: "STUDENT" } }),
    prisma.material.count(),
    prisma.subject.count(),
    prisma.download.count(),
    prisma.material.aggregate({ _sum: { sizeBytes: true } }),
    prisma.material.count({ where: { previewStatus: "FAILED" } }),
    prisma.previewJob.count({ where: { status: { in: ["PENDING", "RUNNING"] } } }),
    prisma.material.count({ where: { indexStatus: "READY" } }),
    prisma.material.count({ where: { indexStatus: "FAILED" } }),
    prisma.documentChunk.count(),
    prisma.material.findMany({
      orderBy: { downloadCount: "desc" },
      take: 5,
      include: { subject: { select: { code: true } } },
    }),
    prisma.user.findMany({
      where: { role: "PROFESSOR" },
      orderBy: { materials: { _count: "desc" } },
      take: 5,
      select: { id: true, name: true, _count: { select: { materials: true } } },
    }),
  ]);

  return {
    userCount,
    professorCount,
    studentCount,
    materialCount,
    subjectCount,
    downloadCount,
    totalBytes: storageBytes._sum.sizeBytes ?? 0,
    failedPreviews,
    runningJobs,
    indexedCount,
    failedIndexes,
    chunkCount,
    topMaterials,
    topProfessors,
    depth: queueDepth(),
    indexDepth: indexQueueDepth(),
  };
}