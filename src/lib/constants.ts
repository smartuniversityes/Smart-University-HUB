/**
 * SQLite has no native enum support in Prisma, so these unions are the
 * single source of truth for values stored in string columns.
 */

export const ROLES = ["ADMIN", "PROFESSOR", "STUDENT"] as const;
export type Role = (typeof ROLES)[number];

export const PREVIEW_STATUSES = [
  "NONE",
  "PENDING",
  "RUNNING",
  "READY",
  "FAILED",
] as const;
export type PreviewStatus = (typeof PREVIEW_STATUSES)[number];

export const JOB_STATUSES = ["PENDING", "RUNNING", "DONE", "FAILED"] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

export const SEMESTERS = [1, 2, 3, 4, 5, 6, 7, 8] as const;

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Admin",
  PROFESSOR: "Professor",
  STUDENT: "Student",
};

/** Roles a person can pick for themselves at sign-up. */
export const SELF_REGISTER_ROLES = ["PROFESSOR", "STUDENT"] as const satisfies readonly Role[];

export function isRole(value: string): value is Role {
  return (ROLES as readonly string[]).includes(value);
}

export function isPreviewStatus(value: string): value is PreviewStatus {
  return (PREVIEW_STATUSES as readonly string[]).includes(value);
}
