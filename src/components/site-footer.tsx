import Link from "next/link";
import { GraduationCap } from "lucide-react";

export function SiteFooter() {
  return (
    <footer className="border-t border-border/60">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <div className="flex items-center gap-2">
          <GraduationCap className="size-4" aria-hidden="true" />
          <span>
            Smart University — Final Year Project. A centralised study material
            hub for students and faculty.
          </span>
        </div>
        <nav className="flex items-center gap-4" aria-label="Footer">
          <Link href="/materials" className="transition-colors hover:text-foreground">
            Materials
          </Link>
          <Link href="/register" className="transition-colors hover:text-foreground">
            Create account
          </Link>
        </nav>
      </div>
    </footer>
  );
}
