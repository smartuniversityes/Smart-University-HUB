import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Info } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { listSubjectOptions } from "@/models/subject";
import { engineAvailable } from "@/lib/conversion";
import { ALLOWED_EXTENSIONS, MAX_UPLOAD_BYTES, FILE_KINDS } from "@/lib/file-types";
import { formatBytes } from "@/lib/format";
import { UploadForm } from "@/components/materials/upload-form";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = { title: "Upload material" };
export const dynamic = "force-dynamic";

export default async function UploadPage() {
  await requireRole("PROFESSOR", "ADMIN");

  const [subjects, canConvert] = await Promise.all([
    listSubjectOptions(),
    engineAvailable(),
  ]);

  const convertible = ALLOWED_EXTENSIONS.filter(
    (ext) => FILE_KINDS[ext].preview === "convert",
  );

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 lg:py-12">
      <Link
        href="/professor/materials"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Back to my uploads
      </Link>

      <h1 className="text-3xl font-semibold tracking-tight">Upload material</h1>
      <p className="mt-2 text-muted-foreground">
        Tag the file with its subject so students can find it. Maximum file size{" "}
        {formatBytes(MAX_UPLOAD_BYTES)}.
      </p>

      {!canConvert ? (
        <Alert variant="destructive" className="mt-6">
          <Info className="size-4" aria-hidden="true" />
          <AlertTitle>Previews for Office files are unavailable</AlertTitle>
          <AlertDescription>
            No conversion engine was found, so PowerPoint, Word and Excel files
            will download but cannot be previewed in the browser. PDFs and text
            files are unaffected. Install LibreOffice to enable previews.
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="mt-8">
        {subjects.length === 0 ? (
          <Alert>
            <Info className="size-4" aria-hidden="true" />
            <AlertTitle>No subjects yet</AlertTitle>
            <AlertDescription>
              An administrator needs to add subjects before material can be
              uploaded. Run the seed script or ask your administrator to add them
              under Admin → Subjects.
            </AlertDescription>
          </Alert>
        ) : (
          <UploadForm subjects={subjects} />
        )}
      </div>

      <section className="mt-10 border-t border-border/60 pt-6">
        <h2 className="text-sm font-medium">Accepted formats</h2>
        <ul className="mt-3 flex flex-wrap gap-2">
          {ALLOWED_EXTENSIONS.map((extension) => {
            const kind = FILE_KINDS[extension];
            return (
              <li key={extension}>
                <Badge
                  variant="secondary"
                  className={`gap-1.5 py-1 font-normal ${kind.accent}`}
                  title={kind.label}
                >
                  {kind.short}
                  {kind.preview === "convert" ? (
                    <span className="opacity-70">· converted</span>
                  ) : null}
                </Badge>
              </li>
            );
          })}
        </ul>
        <p className="mt-3 text-xs text-muted-foreground">
          {convertible.length} of these formats are converted to PDF for
          in-browser preview. The file students download is always the untouched
          original.
        </p>
      </section>
    </div>
  );
}
