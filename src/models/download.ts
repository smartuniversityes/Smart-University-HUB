import "server-only";

import { prisma } from "@/lib/prisma";

/** Records a download and bumps the material's counter, atomically. */
export async function recordDownload(materialId: string, userId: string): Promise<void> {
  await prisma.$transaction([
    prisma.download.create({ data: { materialId, userId } }),
    prisma.material.update({
      where: { id: materialId },
      data: { downloadCount: { increment: 1 } },
    }),
  ]);
}

export async function countDownloads(): Promise<number> {
  return prisma.download.count();
}