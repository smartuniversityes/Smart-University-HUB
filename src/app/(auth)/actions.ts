"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createSession, destroySession, getCurrentUser } from "@/lib/auth";
import { SELF_REGISTER_ROLES, isRole, type Role } from "@/lib/constants";
import {
  attemptLogin,
  createUser,
  hashPassword,
  userExistsByEmail,
} from "@/models/user";

export type FormState = {
  error?: string;
  fieldErrors?: Record<string, string>;
};

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  password: z.string().min(1, "Enter your password"),
});

export async function login(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return {
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string>,
    };
  }

  const user = await attemptLogin(parsed.data.email, parsed.data.password);

  if (!user) {
    return { error: "Incorrect email or password." };
  }
  if (!user.active) {
    return { error: "This account has been deactivated. Contact your administrator." };
  }
  if (!isRole(user.role)) {
    return { error: "This account has an unrecognised role." };
  }

  await createSession({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    department: user.department,
  });

  const next = formData.get("next");
  const target =
    typeof next === "string" && next.startsWith("/") && !next.startsWith("//")
      ? next
      : null;

  if (target) redirect(target);
  if (user.role === "ADMIN") redirect("/admin");
  if (user.role === "PROFESSOR") redirect("/professor/materials");
  redirect("/materials");
}

const registerSchema = z.object({
  name: z.string().trim().min(2, "Enter your full name").max(80),
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  password: z
    .string()
    .min(8, "Use at least 8 characters")
    .max(200, "That password is too long"),
  confirmPassword: z.string(),
  role: z.enum(["PROFESSOR", "STUDENT"]),
  department: z.string().trim().max(80).optional(),
});

export async function register(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = registerSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
    role: formData.get("role"),
    department: formData.get("department") || undefined,
  });

  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors as Record<string, string>;
    if (fieldErrors.confirmPassword && !fieldErrors.password) {
      fieldErrors.password = "Use at least 8 characters";
    }
    return { fieldErrors };
  }

  if (parsed.data.password !== parsed.data.confirmPassword) {
    return { fieldErrors: { confirmPassword: "Passwords do not match" } };
  }

  if (!(SELF_REGISTER_ROLES as readonly string[]).includes(parsed.data.role)) {
    return { fieldErrors: { role: "Choose either Student or Professor" } };
  }

  if (await userExistsByEmail(parsed.data.email)) {
    return { fieldErrors: { email: "An account with this email already exists" } };
  }

  const user = await createUser({
    name: parsed.data.name,
    email: parsed.data.email,
    passwordHash: await hashPassword(parsed.data.password),
    role: parsed.data.role satisfies Role,
    department: parsed.data.department,
  });

  await createSession({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role as Role,
    department: user.department,
  });

  if (user.role === "PROFESSOR") redirect("/professor/upload");
  redirect("/materials");
}

export async function logout(): Promise<void> {
  await destroySession();
  redirect("/");
}

/** Used by forms that need to re-check the session after a mutation. */
export async function requireFreshUser() {
  return getCurrentUser();
}