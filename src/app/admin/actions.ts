"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import type { Role } from "@/lib/constants";
import { reindexAllMaterials } from "@/lib/index-queue";
import {
  createUser as createUserRecord,
  deleteUserById,
  getUserStatus,
  hashPassword,
  setUserActive,
  setUserRole,
  userExistsByEmail,
} from "@/models/user";
import {
  countMaterialsForSubject,
  createSubject as createSubjectRecord,
  deleteSubjectById,
  findSubjectByCode,
} from "@/models/subject";

export type AdminState = {
  error?: string;
  success?: string;
  fieldErrors?: Record<string, string>;
};

/* ------------------------------------------------------------------ users */

const createUserSchema = z.object({
  name: z.string().trim().min(2, "Enter a full name").max(80),
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  password: z.string().min(8, "Use at least 8 characters").max(200),
  role: z.enum(["ADMIN", "PROFESSOR", "STUDENT"]),
  department: z.string().trim().max(80).optional(),
});

/** Admins can create any account, including another administrator. */
export async function createUser(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  await requireRole("ADMIN");

  const parsed = createUserSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    role: formData.get("role"),
    department: formData.get("department") || undefined,
  });
  if (!parsed.success) {
    return {
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string>,
    };
  }

  if (await userExistsByEmail(parsed.data.email)) {
    return { fieldErrors: { email: "That email is already registered" } };
  }

  await createUserRecord({
    name: parsed.data.name,
    email: parsed.data.email,
    passwordHash: await hashPassword(parsed.data.password),
    role: parsed.data.role,
    department: parsed.data.department,
  });

  revalidatePath("/admin/users");
  return { success: `${parsed.data.name} was added.` };
}

const userIdSchema = z.string().min(1, "Missing user id");

/**
 * Activates or deactivates an account. A deactivated user keeps their material
 * but can no longer sign in, and an admin can never lock themselves out.
 */
export async function toggleUserActive(userId: string): Promise<void> {
  const admin = await requireRole("ADMIN");
  const id = userIdSchema.parse(userId);

  if (id === admin.id) {
    throw new Error("You cannot deactivate your own account.");
  }

  const target = await getUserStatus(id);
  if (!target) return;

  await setUserActive(id, !target.active);
  revalidatePath("/admin/users");
}

const roleSchema = z.object({
  role: z.enum(["ADMIN", "PROFESSOR", "STUDENT"]),
});

export async function changeUserRole(userId: string, role: string): Promise<void> {
  const admin = await requireRole("ADMIN");
  const id = userIdSchema.parse(userId);

  const parsed = roleSchema.safeParse({ role });
  if (!parsed.success) throw new Error("That role is not recognised.");
  if (id === admin.id && parsed.data.role !== "ADMIN") {
    throw new Error("You cannot remove your own administrator access.");
  }

  const target = await getUserStatus(id);
  if (!target || target.role === parsed.data.role) return;

  await setUserRole(id, parsed.data.role satisfies Role);
  revalidatePath("/admin/users");
}

export async function deleteUser(userId: string): Promise<void> {
  const admin = await requireRole("ADMIN");
  const id = userIdSchema.parse(userId);

  if (id === admin.id) {
    throw new Error("You cannot delete your own account.");
  }

  await deleteUserById(id);
  revalidatePath("/admin/users");
  revalidatePath("/admin");
}

/* --------------------------------------------------------------- subjects */

const subjectSchema = z.object({
  code: z
    .string()
    .trim()
    .min(2, "Enter a subject code")
    .max(16)
    .regex(/^[A-Za-z0-9-]+$/, "Use letters, numbers and dashes only"),
  name: z.string().trim().min(2, "Enter a subject name").max(120),
  semester: z.coerce.number().int().min(1, "Semester must be 1 to 8").max(8),
  section: z.string().trim().max(20).optional(),
  department: z.string().trim().max(80).optional(),
});

export async function createSubject(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  await requireRole("ADMIN");

  const parsed = subjectSchema.safeParse({
    code: formData.get("code"),
    name: formData.get("name"),
    semester: formData.get("semester"),
    section: formData.get("section") || undefined,
    department: formData.get("department") || undefined,
  });
  if (!parsed.success) {
    return {
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string>,
    };
  }

  const existing = await findSubjectByCode(parsed.data.code.toUpperCase());
  if (existing) {
    return { fieldErrors: { code: "That subject code is already in use" } };
  }

  const created = await createSubjectRecord({
    code: parsed.data.code,
    name: parsed.data.name,
    semester: parsed.data.semester,
    section: parsed.data.section,
    department: parsed.data.department,
  });

  revalidatePath("/admin/subjects");
  revalidatePath("/materials");
  return { success: `${created.code} was added.` };
}

const subjectIdSchema = z.string().min(1, "Missing subject id");

export async function deleteSubject(subjectId: string): Promise<void> {
  await requireRole("ADMIN");
  const id = subjectIdSchema.parse(subjectId);

  // Deleting cascades to the material, so make the consequence explicit first.
  const count = await countMaterialsForSubject(id);
  if (count > 0) {
    throw new Error(
      `This subject still has ${count} material attached. Reassign or remove that material first.`,
    );
  }

  await deleteSubjectById(id);
  revalidatePath("/admin/subjects");
  revalidatePath("/materials");
}

/* -------------------------------------------------------------- chatbot */

/**
 * Rebuilds the study chatbot's index across every real file. Runs in the
 * background queue, so this only queues the work and reports how much there is.
 */
export async function reindexChatbot(): Promise<number> {
  await requireRole("ADMIN");
  const queued = await reindexAllMaterials();
  revalidatePath("/admin");
  return queued;
}