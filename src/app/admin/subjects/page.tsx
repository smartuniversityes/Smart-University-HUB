import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { listSubjectsWithCounts } from "@/models/subject";
import { SubjectManager } from "@/components/admin/subject-manager";

export const metadata: Metadata = { title: "Subjects" };
export const dynamic = "force-dynamic";

export default async function AdminSubjectsPage() {
  await requireRole("ADMIN");

  const subjects = await listSubjectsWithCounts();

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-semibold tracking-tight">Subjects</h1>
      <p className="mt-2 text-muted-foreground">
        Subjects drive the filters students use to find material. A subject can
        only be deleted once its material is gone.
      </p>

      <div className="mt-8">
        <SubjectManager subjects={subjects} />
      </div>
    </div>
  );
}
