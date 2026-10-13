"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Download,
  ExternalLink,
  FileText,
  Loader2,
  Printer,
  RefreshCw,
} from "lucide-react";
import { getFileKind } from "@/lib/file-types";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { TextPreview } from "@/components/materials/text-preview";

type PreviewStatus = "NONE" | "PENDING" | "RUNNING" | "READY" | "FAILED";

type Props = {
  materialId: string;
  extension: string;
  originalName: string;
  initialStatus: PreviewStatus;
  isSample: boolean;
  canPrint: boolean;
};

const POLL_MS = 2000;

/**
 * Handles all three preview strategies in one place: a PDF embedded directly,
 * text rendered in the page, and office formats converted to PDF on demand with
 * a polling status indicator.
 */
export function PreviewPanel({
  materialId,
  extension,
  originalName,
  initialStatus,
  isSample,
  canPrint,
}: Props) {
  const kind = getFileKind(extension);
  const [status, setStatus] = useState<PreviewStatus>(initialStatus);
  const [error, setError] = useState<string | null>(null);
  const [cacheBuster, setCacheBuster] = useState(0);
  const requested = useRef(false);

  const mode = kind?.preview ?? "none";

  const isBusy = status === "PENDING" || status === "RUNNING";
  const pdfUrl = `/api/materials/${materialId}/preview`;

  const startConversion = useCallback(async () => {
    try {
      const response = await fetch(`/api/materials/${materialId}/preview/convert`, {
        method: "POST",
      });
      const data = (await response.json()) as { status?: string; error?: string };
      if (!response.ok) {
        setError(data.error ?? "Preview could not be started.");
        return;
      }
      setStatus((data.status as PreviewStatus) ?? "PENDING");
    } catch {
      setError("Could not reach the server to start the preview.");
    }
  }, [materialId]);

  // Kick off conversion the first time an office file is opened.
  useEffect(() => {
    if (mode !== "convert" || isSample) return;
    if (status === "READY" || status === "FAILED") return;
    if (requested.current) return;
    requested.current = true;
    void startConversion();
  }, [mode, isSample, status, startConversion]);

  useEffect(() => {
    if (!isBusy) return;
    const timer = window.setInterval(async () => {
      try {
        const response = await fetch(`/api/materials/${materialId}/preview/status`, {
          cache: "no-store",
        });
        if (!response.ok) return;
        const data = (await response.json()) as {
          status: PreviewStatus;
          error: string | null;
        };
        setStatus(data.status);
        if (data.status === "FAILED") setError(data.error ?? "Conversion failed.");
        if (data.status === "READY") setCacheBuster(Date.now());
      } catch {
        // Transient network errors are ignored; the next tick retries.
      }
    }, POLL_MS);
    return () => window.clearInterval(timer);
  }, [isBusy, materialId]);

  function retry() {
    requested.current = false;
    setError(null);
    setStatus("NONE");
    void startConversion();
  }

  if (isSample) {
    return (
      <PreviewShell>
        <div className="flex flex-col items-center gap-2 px-6 py-16 text-center">
          <FileText className="size-8 text-muted-foreground" aria-hidden="true" />
          <p className="font-medium">No file stored for this record</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            This row comes from the seed script and has no file behind it yet.
            Upload a real file to preview and download it.
          </p>
        </div>
      </PreviewShell>
    );
  }

  if (mode === "none") {
    return (
      <PreviewShell>
        <div className="flex flex-col items-center gap-2 px-6 py-16 text-center">
          <FileText className="size-8 text-muted-foreground" aria-hidden="true" />
          <p className="font-medium">No preview for this format</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            {kind?.label ?? "This file type"} cannot be shown in the browser.
            Download it to open in the right application.
          </p>
        </div>
      </PreviewShell>
    );
  }

  if (mode === "text") {
    return (
      <PreviewShell>
        <TextPreview materialId={materialId} extension={extension} />
      </PreviewShell>
    );
  }

  // PDF and converted office documents both render through the same viewer.
  if (status === "READY") {
    return (
      <div className="overflow-hidden rounded-xl border border-border/60">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 bg-muted/30 px-4 py-2.5 print-hidden">
          <p className="truncate text-sm font-medium">
            {mode === "pdf" ? originalName : `${originalName} (converted preview)`}
          </p>
          <div className="flex items-center gap-1">
            <Button asChild variant="ghost" size="sm" aria-label="Open preview in a new tab">
              <a href={pdfUrl} target="_blank" rel="noreferrer">
                <ExternalLink className="size-4" aria-hidden="true" />
                Open
              </a>
            </Button>
            {canPrint ? (
              <Button asChild variant="ghost" size="sm">
                <a href={`/materials/${materialId}/print`} target="_blank" rel="noreferrer">
                  <Printer className="size-4" aria-hidden="true" />
                  Print
                </a>
              </Button>
            ) : null}
            <Button asChild size="sm">
              <a href={`/api/materials/${materialId}/download`}>
                <Download className="size-4" aria-hidden="true" />
                Download
              </a>
            </Button>
          </div>
        </div>
        <object
          // The query keeps the embedded viewer from showing a stale PDF.
          data={`${pdfUrl}?v=${cacheBuster}`}
          type="application/pdf"
          className="h-[70vh] min-h-[420px] w-full bg-muted/20"
          aria-label={`Preview of ${originalName}`}
        >
          <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
            <p className="font-medium">
              Your browser cannot display PDFs inline
            </p>
            <p className="text-sm text-muted-foreground">
              Use the Open button above to view it in a new tab.
            </p>
          </div>
        </object>
      </div>
    );
  }

  if (status === "FAILED") {
    return (
      <PreviewShell>
        <div className="px-6 py-10">
          <Alert variant="destructive">
            <AlertTriangle className="size-4" aria-hidden="true" />
            <AlertTitle>Preview unavailable</AlertTitle>
            <AlertDescription>
              {error ?? "The document could not be converted for preview."} The
              original file is unaffected and can still be downloaded.
            </AlertDescription>
          </Alert>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={retry}>
              <RefreshCw className="size-4" aria-hidden="true" />
              Try again
            </Button>
            <Button asChild size="sm">
              <a href={`/api/materials/${materialId}/download`}>
                <Download className="size-4" aria-hidden="true" />
                Download original
              </a>
            </Button>
          </div>
        </div>
      </PreviewShell>
    );
  }

  return (
    <PreviewShell>
      <div className="space-y-4 px-6 py-10">
        <div className="flex items-center gap-3">
          <Loader2 className="size-5 animate-spin text-primary" aria-hidden="true" />
          <div>
            <p className="font-medium">
              {status === "RUNNING" ? "Converting to PDF..." : "Preparing preview..."}
            </p>
            <p className="text-sm text-muted-foreground">
              This runs once, then the PDF is cached for everyone.
            </p>
          </div>
        </div>
        <div className="space-y-2">
          <Skeleton className="h-40 w-full rounded-lg" />
          <Skeleton className="h-40 w-full rounded-lg" />
        </div>
      </div>
    </PreviewShell>
  );
}

function PreviewShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border/60">
      {children}
    </div>
  );
}
