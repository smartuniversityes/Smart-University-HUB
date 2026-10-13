import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Download, Eye, FileText, Pencil, Trash2, User } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { isPreviewStatus } from "@/lib/constants";
import { getFileKind } from "@/lib/file-types";
import { formatBytes, formatDateTime } from "@/lib/format";
import { isSampleRecord } from "@/lib/materials";
import { getMaterialDetail, getMaterialMeta } from "@/models/material";
import { getFavorite } from "@/models/favorite";
import { PreviewPanel } from "@/components/materials/preview-panel";
import { FavouriteButton } from "@/components/materials/favourite-button";
import { FileTypeBadge } from "@/components/materials/material-card";
import { DeleteMaterialButton } from "@/components/materials/delete-material-button";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: PageProps<"/materials/[id]">): Promise<Metadata> {
  const { id } = await params;
  const material = await getMaterialMeta(id);
  if (!material) return { title: "Material not found" };
  return {
    title: material.title,
    description: material.description ?? undefined,
  };
}

export default async function MaterialDetailPage({
  params,
}: PageProps<"/materials/[id]">) {
  const { id } = await params;
  const user = await getCurrentUser();

  const material = await getMaterialDetail(id);
  if (!material) notFound();

  const favourite = user ? Boolean(await getFavorite(user.id, material.id)) : false;

  const isOwner = user?.id === material.professorId;
  const canManage = user?.role === "ADMIN" || isOwner;
  const kind = getFileKind(material.extension);
  const sample = isSampleRecord(material);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <nav className="mb-6 text-sm text-muted-foreground" aria-label="Breadcrumb">
        <Link href="/materials" className="transition-colors hover:text-foreground">
          Study material
        </Link>
        <span aria-hidden="true"> / </span>
        <span>{material.subject.code}</span>
      </nav>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <FileTypeBadge extension={material.extension} />
            <span className="text-xs text-muted-foreground">
              {kind?.label ?? material.extension.toUpperCase()}
            </span>
          </div>
          <h1 className="mt-2 break-words text-3xl font-semibold tracking-tight">
            {material.title}
          </h1>
          <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
            <span>{material.subject.code} — {material.subject.name}</span>
            <span aria-hidden="true">·</span>
            <span>Semester {material.subject.semester}</span>
            <span aria-hidden="true">·</span>
            <span className="inline-flex items-center gap-1">
              <User className="size-3.5" aria-hidden="true" />
              {material.professor.name}
            </span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 print-hidden">
          {user ? (
            <FavouriteButton materialId={material.id} initialFavourite={favourite} />
          ) : null}
          {canManage ? (
            <Button asChild variant="outline" size="sm">
              <Link href={`/professor/materials/${material.id}/edit`}>
                <Pencil className="size-4" aria-hidden="true" />
                Edit
              </Link>
            </Button>
          ) : null}
          {canManage ? <DeleteMaterialButton materialId={material.id} /> : null}
          {user ? (
            <Button asChild>
              <a href={`/api/materials/${material.id}/download`}>
                <Download className="size-4" aria-hidden="true" />
                Download
              </a>
            </Button>
          ) : (
            <Button asChild>
              <Link href={`/login?next=/materials/${material.id}`}>
                Sign in to download
              </Link>
            </Button>
          )}
        </div>
      </div>

      {material.description ? (
        <p className="mt-5 max-w-3xl whitespace-pre-line text-muted-foreground">
          {material.description}
        </p>
      ) : null}

      <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <FileText className="size-4" aria-hidden="true" />
          {formatBytes(material.sizeBytes)}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Eye className="size-4" aria-hidden="true" />
          {material._count.downloads} download
          {material._count.downloads === 1 ? "" : "s"}
        </span>
        <span>Uploaded {formatDateTime(material.createdAt)}</span>
        <span className="font-mono text-xs">{material.originalName}</span>
      </div>

      <Separator className="my-8" />

      <section aria-label="Material preview">
        <h2 className="mb-4 text-lg font-medium">Preview</h2>
        <PreviewPanel
          materialId={material.id}
          extension={material.extension}
          originalName={material.originalName}
          initialStatus={
            isPreviewStatus(material.previewStatus) ? material.previewStatus : "NONE"
          }
          isSample={sample}
          canPrint={Boolean(user)}
        />
      </section>

      {user?.role === "PROFESSOR" && isOwner ? (
        <p className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
          <Trash2 className="size-4" aria-hidden="true" />
          You uploaded this material, so you can edit its details or delete it.
        </p>
      ) : null}
    </div>
  );
}
