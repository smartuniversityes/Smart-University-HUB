"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, FileText, Loader2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FILE_KINDS } from "@/lib/file-types";

/**
 * Text and markdown files are rendered client-side from a sanitised HTML payload
 * produced by the server, so nothing untrusted is ever injected as raw markup.
 */
export function TextPreview({
  materialId,
  extension,
}: {
  materialId: string;
  extension: string;
}) {
  const [state, setState] = useState<
    | { status: "loading" }
    | { status: "ready"; html: string; truncated: boolean }
    | { status: "unauthenticated" }
    | { status: "error"; message: string }
  >({ status: "loading" });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await fetch(`/api/materials/${materialId}/content`, {
          cache: "no-store",
        });

        if (response.status === 401) {
          if (!cancelled) setState({ status: "unauthenticated" });
          return;
        }
        if (!response.ok) {
          const data = (await response.json().catch(() => null)) as {
            error?: string;
          } | null;
          if (!cancelled) {
            setState({ status: "error", message: data?.error ?? "Could not read this file." });
          }
          return;
        }

        const data = (await response.json()) as { html: string; truncated: boolean };
        if (!cancelled) {
          setState({ status: "ready", html: data.html, truncated: data.truncated });
        }
      } catch {
        if (!cancelled) setState({ status: "error", message: "Network error." });
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [materialId]);

  if (state.status === "loading") {
    return (
      <div className="flex items-center gap-3 px-6 py-16 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        Loading preview...
      </div>
    );
  }

  if (state.status === "unauthenticated") {
    return (
      <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
        <FileText className="size-7 text-muted-foreground" aria-hidden="true" />
        <p className="font-medium">Sign in to read this file</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          Previews of text documents are limited to signed-in users.
        </p>
        <Button asChild size="sm" className="mt-1">
          <a href={`/login?next=/materials`}>Go to sign in</a>
        </Button>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="px-6 py-10">
        <Alert variant="destructive">
          <AlertTriangle className="size-4" aria-hidden="true" />
          <AlertTitle>Preview unavailable</AlertTitle>
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 bg-muted/30 px-4 py-2.5 print-hidden">
        <p className="text-sm font-medium">
          {FILE_KINDS[extension.toLowerCase()]?.label ?? "Text file"}
        </p>
        {state.truncated ? (
          <p className="text-xs text-muted-foreground">
            Showing the beginning of this file only.
          </p>
        ) : null}
      </div>
      <div
        className="prose prose-sm max-w-none px-5 py-6 dark:prose-invert"
        // Sanitised on the server with DOMPurify before it is sent here.
        dangerouslySetInnerHTML={{ __html: state.html }}
      />
    </div>
  );
}
