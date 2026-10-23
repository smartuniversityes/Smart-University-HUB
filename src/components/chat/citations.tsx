"use client";

import Link from "next/link";
import { FileText } from "lucide-react";
import type { Citation } from "@/lib/chat-types";
import { cn } from "@/lib/utils";

/**
 * The "Sources" block under an assistant answer. Every card links back to the
 * material page and shows the exact quote the answer was built from, so a
 * student can verify the answer instead of trusting it blindly.
 */
export function CitationList({
  citations,
  className,
}: {
  citations: Citation[];
  className?: string;
}) {
  if (citations.length === 0) return null;

  return (
    <div className={cn("mt-3", className)}>
      <p className="text-xs font-medium text-muted-foreground">
        Sources {citations.length > 0 ? `(${citations.length})` : ""}
      </p>
      <ul className="mt-1.5 space-y-1.5">
        {citations.map((citation, index) => (
          <li key={`${citation.materialId}-${index}`}>
            <Link
              href={`/materials/${citation.materialId}`}
              className="group flex gap-2.5 rounded-lg border border-border/60 bg-muted/20 px-3 py-2 transition-colors hover:border-primary/40 hover:bg-muted/50"
            >
              <span className="mt-0.5 w-5 shrink-0 text-xs font-semibold tabular-nums text-primary">
                [{index + 1}]
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm">
                  <span className="inline-flex items-center gap-1.5 font-medium group-hover:text-primary">
                    <FileText className="size-3.5 shrink-0" aria-hidden="true" />
                    <span className="truncate">{citation.title}</span>
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {citation.subjectCode}
                    {citation.pageLabel ? ` · ${citation.pageLabel}` : ""}
                  </span>
                </span>
                <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                  “{citation.quote}”
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
