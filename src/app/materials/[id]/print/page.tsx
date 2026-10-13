import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getPrintPayload } from "@/models/material";
import { isSafeStoredName, readPreview } from "@/lib/storage";
import { getFileKind } from "@/lib/file-types";
import { formatDateTime } from "@/lib/format";
import { PrintButton } from "@/components/materials/print-button";

export const dynamic = "force-dynamic";

/**
 * A dedicated A4 view for printing. Only the cached PDF is printed, so an
 * office file is printed through its converted version rather than the original
 * binary.
 */
export default async function PrintMaterialPage({
  params,
}: PageProps<"/materials/[id]/print">) {
  await requireUser();
  const { id } = await params;

  const material = await getPrintPayload(id);
  if (!material) notFound();
  if (material.storedName.startsWith("sample-")) notFound();

  if (material.previewStatus !== "READY" || !material.previewPath) {
    return (
      <PrintShell title={material.title}>
        <p className="text-sm text-muted-foreground">
          This material has no printable preview yet. Open the material page and
          wait for the conversion to finish.
        </p>
        <a
          href={`/materials/${material.id}`}
          className="mt-3 inline-block text-sm text-primary underline"
        >
          Back to material
        </a>
      </PrintShell>
    );
  }

  let pdf: Buffer | null = null;
  try {
    if (isSafeStoredName(material.previewPath)) {
      pdf = await readPreview(material.previewPath);
    }
  } catch {
    pdf = null;
  }
  if (!pdf) {
    return (
      <PrintShell title={material.title}>
        <p className="text-sm text-muted-foreground">
          The cached preview could not be read.
        </p>
      </PrintShell>
    );
  }

  const kind = getFileKind(material.extension);

  return (
    <div className="min-h-screen bg-white text-black">
      <div className="print-hidden border-b border-neutral-200 px-6 py-4">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-medium">{material.title}</p>
            <p className="text-sm text-neutral-500">
              {material.subject.code} — {material.subject.name} · Semester{" "}
              {material.subject.semester}
            </p>
          </div>
          <PrintButton />
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-6 py-6">
        <object
          data={`/api/materials/${material.id}/preview`}
          type="application/pdf"
          className="h-[80vh] w-full"
          aria-label={`Printable version of ${material.title}`}
        >
          <p className="text-sm">
            Your browser cannot display PDFs inline.{" "}
            <a className="underline" href={`/api/materials/${material.id}/preview`}>
              Open the PDF
            </a>{" "}
            and print from there.
          </p>
        </object>

        <footer className="mt-6 border-t border-neutral-200 pt-3 text-xs text-neutral-500">
          <p>
            {material.professor.name} · {kind?.label ?? material.extension.toUpperCase()}{" "}
            · uploaded {formatDateTime(material.createdAt)}
          </p>
        </footer>
      </div>
    </div>
  );
}

function PrintShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      {children}
    </div>
  );
}
