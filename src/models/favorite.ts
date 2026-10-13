import "server-only";

import { prisma } from "@/lib/prisma";

export async function getFavorite(userId: string, materialId: string) {
  return prisma.favorite.findUnique({
    where: { userId_materialId: { userId, materialId } },
    select: { id: true },
  });
}

/** Adds or removes a user's favourite, returning the new state. */
export async function toggleFavorite(userId: string, materialId: string): Promise<boolean> {
  const material = await prisma.material.findUnique({
    where: { id: materialId },
    select: { id: true },
  });
  if (!material) throw new Error("That material no longer exists.");

  const existing = await getFavorite(userId, materialId);
  if (existing) {
    await prisma.favorite.delete({ where: { id: existing.id } });
  } else {
    await prisma.favorite.create({ data: { userId, materialId } });
  }
  return !existing;
}

/** The favourite materials for a user's saved list, newest first. */
export async function listFavoriteMaterials(userId: string) {
  const favorites = await prisma.favorite.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: {
      material: {
        include: { subject: true, professor: { select: { id: true, name: true } } },
      },
    },
  });
  return favorites.map((favorite) => favorite.material);
}