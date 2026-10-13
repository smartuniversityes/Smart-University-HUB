import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { getMaterialForEdit } from "@/models/material";
import { listSubjectOptions } from "@/models/subject";
import { EditMaterialForm } from "@/components/materials/edit-material-form";
import { FileTypeBadge } from "@/components/materials/material-card";
import { formatBytes, formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Edit material" };
export const dynamic = "force-dynamic";

export default async function EditMaterialPage({
  params,
}: PageProps<"/professor/materials/[id]/edit">) {
  const user = await requireRole("PROFESSOR", "ADMIN");
  const { id } = await params;

  const material = await getMaterialForEdit(id);
  if (!material) notFound();
  if (user.role !== "ADMIN" && material.professorId !== user.id) notFound();

  const subjects = await listSubjectOptions();

  const hasRealFile = !material.storedName.startsWith("sample-");

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6 lg:py-12">
      <Link
        href="/professor/materials"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Back to my uploads
      </Link>

      <h1 className="text-3xl font-semibold tracking-tight">Edit material</h1>

      <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <FileTypeBadge extension={material.extension} />
        <span>{material.originalName}</span>
        {hasRealFile ? <span>· {formatBytes(material.sizeBytes)}</span> : null}
        <span>· uploaded {formatDateTime(material.createdAt)}</span>
      </div>

      <p className="mt-2 text-xs text-muted-foreground">
        The uploaded file itself cannot be changed. To replace it, upload a new
        copy and delete this one.
      </p>

      <div className="mt-8">
        <EditMaterialForm
          material={{
            id: material.id,
            title: material.title,
            description: material.description,
            subjectId: material.subjectId,
          }}
          subjects={subjects.map((subject) => ({
            id: subject.id,
            code: subject.code,
            name: subject.name,
            semester: subject.semester,
          }))}
        />
      </div>
    </div>
  );
}
