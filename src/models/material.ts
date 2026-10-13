import "server-only";

import { prisma } from "@/lib/prisma";
import {
  PAGE_SIZE,
  buildMaterialOrderBy,
  buildMaterialWhere,
  type MaterialFilters,
} from "@/lib/materials";
import type { PreviewStatus } from "@/lib/constants";

export type CreateMaterialInput = {
  title: string;
  description: string | null;
  originalName: string;
  storedName: string;
  extension: string;
  mimeType: string;
  sizeBytes: number;
  previewStatus: "READY" | "NONE";
  previewPath: string | null;
  previewEngine: "original" | null;
  subjectId: string;
  professorId: string;
};

export type { PreviewStatus };

/** Paginated, filtered listing used by the materials grid. */
export async function findMaterials(filters: MaterialFilters, userId?: string) {
  const where = buildMaterialWhere(filters, userId);
  const orderBy = buildMaterialOrderBy(filters.sort);
  const page = filters.page ?? 1;
  const skip = (page - 1) * PAGE_SIZE;

  const [items, total] = await Promise.all([
    prisma.material.findMany({
      where,
      orderBy,
      skip,
      take: PAGE_SIZE,
      include: { subject: true, professor: true },
    }),
    prisma.material.count({ where }),
  ]);

  return {
    items,
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  };
}

/** Options used to populate the filter dropdowns. */
export async function getFilterOptions() {
  const [subjects, professors] = await Promise.all([
    prisma.subject.findMany({
      orderBy: [{ semester: "asc" }, { code: "asc" }],
      select: { id: true, code: true, name: true, semester: true },
    }),
    prisma.user.findMany({
      where: { role: "PROFESSOR", active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);
  return { subjects, professors };
}

export async function getRecentMaterials(take: number) {
  return prisma.material.findMany({
    take,
    orderBy: { createdAt: "desc" },
    include: { subject: true, professor: true },
  });
}

export async function countMaterials(): Promise<number> {
  return prisma.material.count();
}

export async function getMaterialMeta(id: string) {
  return prisma.material.findUnique({
    where: { id },
    select: { title: true, description: true },
  });
}

export async function getMaterialDetail(id: string) {
  return prisma.material.findUnique({
    where: { id },
    include: {
      subject: true,
      professor: { select: { id: true, name: true, department: true } },
      _count: { select: { downloads: true, favorites: true } },
    },
  });
}

export async function getMaterialForEdit(id: string) {
  return prisma.material.findUnique({ where: { id }, include: { subject: true } });
}

/** Slim row for mutation guards: ownership checks and file cleanup. */
export async function getMaterialForManage(id: string) {
  return prisma.material.findUnique({
    where: { id },
    select: { id: true, professorId: true, storedName: true, previewPath: true },
  });
}

export async function createMaterial(data: CreateMaterialInput) {
  return prisma.material.create({ data });
}

export async function updateMaterialFields(
  id: string,
  data: { title: string; description: string | null; subjectId: string },
) {
  return prisma.material.update({ where: { id }, data });
}

export async function deleteMaterialById(id: string): Promise<void> {
  await prisma.material.delete({ where: { id } });
}

/** Professor's own uploads (or everything, for admins). */
export async function listProfMaterial(userId: string, isAdmin: boolean) {
  return prisma.material.findMany({
    where: isAdmin ? {} : { professorId: userId },
    orderBy: { createdAt: "desc" },
    include: { subject: true },
  });
}

/* ------------------------------------------------------------------ slim
   read models used by the API controllers so the handlers stay thin. --------- */

export async function getDownloadPayload(id: string) {
  return prisma.material.findUnique({
    where: { id },
    select: { id: true, storedName: true, originalName: true, mimeType: true },
  });
}

export async function getPreviewPayload(id: string) {
  return prisma.material.findUnique({
    where: { id },
    select: { id: true, previewPath: true, previewStatus: true, title: true },
  });
}

export async function getConvertTarget(id: string) {
  return prisma.material.findUnique({
    where: { id },
    select: { id: true, extension: true, previewStatus: true, previewError: true },
  });
}

export async function getStatusPayload(id: string) {
  return prisma.material.findUnique({
    where: { id },
    select: {
      id: true,
      previewStatus: true,
      previewError: true,
      previewEngine: true,
      updatedAt: true,
    },
  });
}

export async function getContentPayload(id: string) {
  return prisma.material.findUnique({
    where: { id },
    select: { id: true, extension: true, storedName: true, title: true },
  });
}

export async function getPrintPayload(id: string) {
  return prisma.material.findUnique({
    where: { id },
    include: { subject: true, professor: { select: { name: true } } },
  });
}