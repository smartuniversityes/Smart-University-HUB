import type { Prisma } from "@/generated/prisma/client";

export const PAGE_SIZE = 12;

export type MaterialFilters = {
  query?: string;
  semester?: number;
  subjectId?: string;
  professorId?: string;
  extension?: string;
  sort?: "recent" | "popular" | "title";
  page?: number;
};

export function parseFilters(
  params: Record<string, string | string[] | undefined>,
): MaterialFilters {
  const first = (value: string | string[] | undefined): string | undefined => {
    if (Array.isArray(value)) return value[0];
    return value || undefined;
  };

  const semesterRaw = first(params.semester);
  const pageRaw = first(params.page);
  const sortRaw = first(params.sort);

  const semester = semesterRaw ? Number.parseInt(semesterRaw, 10) : undefined;
  const page = pageRaw ? Number.parseInt(pageRaw, 10) : undefined;
  const query = first(params.q)?.trim();

  return {
    query: query || undefined,
    semester: semester && semester >= 1 && semester <= 8 ? semester : undefined,
    subjectId: first(params.subject),
    professorId: first(params.professor),
    extension: first(params.type),
    sort:
      sortRaw === "popular" || sortRaw === "title" || sortRaw === "recent"
        ? sortRaw
        : "recent",
    page: page && page > 0 ? page : 1,
  };
}

export function buildMaterialWhere(
  filters: MaterialFilters,
  userId?: string,
): Prisma.MaterialWhereInput {
  const where: Prisma.MaterialWhereInput = {};

  if (filters.query) {
    // SQLite's LIKE is case-insensitive for ASCII, which is enough here.
    where.OR = [
      { title: { contains: filters.query } },
      { description: { contains: filters.query } },
      { originalName: { contains: filters.query } },
      { subject: { name: { contains: filters.query } } },
      { subject: { code: { contains: filters.query } } },
      { professor: { name: { contains: filters.query } } },
    ];
  }

  if (filters.semester) {
    where.subject = { ...(where.subject as object), semester: filters.semester };
  }
  if (filters.subjectId) {
    where.subject = { ...(where.subject as object), id: filters.subjectId };
  }
  if (filters.professorId) {
    where.professorId = filters.professorId;
  }
  if (filters.extension) {
    where.extension = filters.extension;
  }
  if (userId) {
    where.favorites = { some: { userId } };
  }

  return where;
}

/**
 * The sample rows created by the seed script have no real file on disk, so they
 * are rendered without a download action rather than linking to a 404.
 */
export function isSampleRecord(material: { storedName: string; sizeBytes: number }) {
  return material.storedName.startsWith("sample-") || material.sizeBytes === 0;
}

export function buildMaterialOrderBy(
  sort: MaterialFilters["sort"],
): Prisma.MaterialOrderByWithRelationInput[] {
  switch (sort) {
    case "popular":
      return [{ downloadCount: "desc" }, { createdAt: "desc" }];
    case "title":
      return [{ title: "asc" }];
    default:
      return [{ createdAt: "desc" }];
  }
}

export type MaterialWithRelations = Prisma.MaterialGetPayload<{
  include: { subject: true; professor: true };
}>;