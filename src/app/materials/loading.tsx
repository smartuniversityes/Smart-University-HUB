import { Loader2 } from "lucide-react";

/**
 * Rendered while a server page is streaming, so a slow database read does not
 * look like a broken page.
 */
export default function Loading() {
  return (
    <div className="mx-auto flex min-h-[60vh] w-full max-w-7xl items-center justify-center px-4">
      <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden="true" />
      <span className="sr-only">Loading</span>
    </div>
  );
}
