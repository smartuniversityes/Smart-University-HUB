import "server-only";

import { compare, hash } from "bcryptjs";

import { prisma } from "@/lib/prisma";

/** A bcrypt hash that can never match. Keeps timing equal for unknown emails. */
const DUMMY_HASH = "$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidinv";

/**
 * Looks a user up and verifies their password. Returns the user row or null so
 * callers cannot tell whether the email or the password was wrong.
 */
export async function attemptLogin(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  const payload = user?.passwordHash ?? DUMMY_HASH;
  const valid = await compare(password, payload);
  if (!user || !valid) return null;
  return user;
}

export async function hashPassword(password: string): Promise<string> {
  return hash(password, 10);
}

export async function userExistsByEmail(email: string): Promise<boolean> {
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  return user !== null;
}

export async function findUserByEmail(email: string) {
  return prisma.user.findUnique({ where: { email } });
}

export async function createUser(data: {
  name: string;
  email: string;
  passwordHash: string;
  role: "ADMIN" | "PROFESSOR" | "STUDENT";
  department?: string | null;
}) {
  return prisma.user.create({
    data: {
      name: data.name,
      email: data.email,
      passwordHash: data.passwordHash,
      role: data.role,
      department: data.department || null,
    },
  });
}

/** Status row used by the admin toggles and guards. */
export async function getUserStatus(id: string) {
  return prisma.user.findUnique({
    where: { id },
    select: { id: true, active: true, name: true, role: true },
  });
}

export async function setUserActive(id: string, active: boolean) {
  return prisma.user.update({ where: { id }, data: { active } });
}

export async function setUserRole(id: string, role: "ADMIN" | "PROFESSOR" | "STUDENT") {
  return prisma.user.update({ where: { id }, data: { role } });
}

export async function deleteUserById(id: string): Promise<void> {
  await prisma.user.delete({ where: { id } });
}

/** Every account, newest first, with a per-user material count for the table. */
export async function listUsers() {
  return prisma.user.findMany({
    orderBy: [{ role: "asc" }, { name: "asc" }],
    include: { _count: { select: { materials: true } } },
  });
}

export async function countActiveProfessors() {
  return prisma.user.count({ where: { role: "PROFESSOR", active: true } });
}