import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { listUsers } from "@/models/user";
import { UserManager } from "@/components/admin/user-manager";

export const metadata: Metadata = { title: "Users" };
export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const admin = await requireRole("ADMIN");

  const users = await listUsers();

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-semibold tracking-tight">Users</h1>
      <p className="mt-2 text-muted-foreground">
        Create accounts, change roles and deactivate access. Deleting a user also
        removes the material they uploaded.
      </p>

      <div className="mt-8">
        <UserManager users={users} currentUserId={admin.id} />
      </div>
    </div>
  );
}
