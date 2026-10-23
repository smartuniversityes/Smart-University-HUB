import Link from "next/link";
import { GraduationCap } from "lucide-react";
import { cn } from "@/lib/utils";
import { SITE_NAME, SITE_TAGLINE } from "@/lib/site";

export function Logo({ className }: { className?: string }) {
  return (
    <Link
      href="/"
      className={cn("group inline-flex items-center gap-2.5", className)}
      aria-label={`${SITE_NAME} home`}
    >
      <span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground transition-transform group-hover:scale-105">
        <GraduationCap className="size-5" aria-hidden="true" />
      </span>
      <span className="flex flex-col leading-none">
        <span className="text-[15px] font-semibold tracking-tight">
          {SITE_NAME}
        </span>
        <span className="text-[11px] text-muted-foreground">{SITE_TAGLINE}</span>
      </span>
    </Link>
  );
}
