import Link from "next/link";
import { GraduationCap } from "lucide-react";
import { cn } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
  return (
    <Link
      href="/"
      className={cn("group inline-flex items-center gap-2.5", className)}
      aria-label="Smart University home"
    >
      <span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground transition-transform group-hover:scale-105">
        <GraduationCap className="size-5" aria-hidden="true" />
      </span>
      <span className="flex flex-col leading-none">
        <span className="text-[15px] font-semibold tracking-tight">
          Smart University
        </span>
        <span className="text-[11px] text-muted-foreground">Study Material Hub</span>
      </span>
    </Link>
  );
}
