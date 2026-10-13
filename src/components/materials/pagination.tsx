"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Pagination({ page, pageCount }: { page: number; pageCount: number }) {
  const router = useRouter();
  const current = useSearchParams();
  const [pending, startTransition] = useTransition();

  if (pageCount <= 1) return null;

  function goTo(next: number) {
    const params = new URLSearchParams(current.toString());
    if (next <= 1) params.delete("page");
    else params.set("page", String(next));
    startTransition(() => {
      router.push(`/materials${params.size > 0 ? `?${params.toString()}` : ""}`, {
        scroll: false,
      });
    });
  }

  /** Compact 1 … 4 5 6 … 12 style window. */
  function pageNumbers(): Array<number | "gap"> {
    if (pageCount <= 7) {
      return Array.from({ length: pageCount }, (_, index) => index + 1);
    }
    const numbers = new Set<number>([1, pageCount, page, page - 1, page + 1]);
    const sorted = [...numbers].filter((n) => n >= 1 && n <= pageCount).sort((a, b) => a - b);
    const output: Array<number | "gap"> = [];
    let previous = 0;
    for (const value of sorted) {
      if (previous && value - previous > 1) output.push("gap");
      output.push(value);
      previous = value;
    }
    return output;
  }

  return (
    <nav
      className="mt-10 flex items-center justify-center gap-1"
      aria-label="Pagination"
      data-pending={pending ? "true" : "false"}
    >
      <Button
        variant="outline"
        size="icon"
        onClick={() => goTo(page - 1)}
        disabled={page <= 1 || pending}
        aria-label="Previous page"
      >
        <ChevronLeft className="size-4" aria-hidden="true" />
      </Button>

      {pageNumbers().map((entry, index) =>
        entry === "gap" ? (
          <span key={`gap-${index}`} className="px-1.5 text-muted-foreground">
            …
          </span>
        ) : (
          <Button
            key={entry}
            variant={entry === page ? "default" : "ghost"}
            size="icon"
            onClick={() => goTo(entry)}
            disabled={pending}
            aria-label={`Page ${entry}`}
            aria-current={entry === page ? "page" : undefined}
            className="tabular-nums"
          >
            {entry}
          </Button>
        ),
      )}

      <Button
        variant="outline"
        size="icon"
        onClick={() => goTo(page + 1)}
        disabled={page >= pageCount || pending}
        aria-label="Next page"
      >
        <ChevronRight className="size-4" aria-hidden="true" />
      </Button>
    </nav>
  );
}
