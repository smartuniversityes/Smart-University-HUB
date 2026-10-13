import "server-only";

import { prisma } from "@/lib/prisma";

/** All subjects ordered for the admin table, with a material count each. */
export async function listSubjectsWithCounts() {
  return prisma.subject.findMany({
    orderBy: [{ semester: "asc" }, { code: "asc" }],
    include: { _count: { select: { materials: true } } },
  });
}

/** Ordered subjects used to populate pickers (upload form, filters, selectors). */
export async function listSubjectOptions() {
  return prisma.subject.findMany({ orderBy: [{ semester: "asc" }, { code: "asc" }] });
}

export async function findSubjectByCode(code: string) {
  return prisma.subject.findUnique({ where: { code }, select: { id: true } });
}

export async function findSubjectById(id: string) {
  return prisma.subject.findUnique({ where: { id }, select: { id: true } });
}

export async function createSubject(data: {
  code: string;
  name: string;
  semester: number;
  section?: string;
  department?: string;
}) {
  return prisma.subject.create({
    data: {
      code: data.code.toUpperCase(),
      name: data.name,
      semester: data.semester,
      section: data.section || null,
      department: data.department || null,
    },
  });
}

export async function countMaterialsForSubject(subjectId: string): Promise<number> {
  return prisma.material.count({ where: { subjectId } });
}

export async function countSubjects(): Promise<number> {
  return prisma.subject.count();
}

export async function deleteSubjectById(id: string): Promise<void> {
  await prisma.subject.delete({ where: { id } });
}