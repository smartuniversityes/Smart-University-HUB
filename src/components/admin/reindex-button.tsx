"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCcw } from "lucide-react";
import { toast } from "sonner";
import { reindexChatbot } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";

/**
 * Admin control: rebuild the chatbot's index for every uploaded file. Work
 * happens in the background queue, so the button only reports how many items
 * were queued and the dashboard's status line shows progress afterwards.
 */
export function ReindexButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function run() {
    startTransition(async () => {
      try {
        const queued = await reindexChatbot();
        toast.success(
          queued === 0
            ? "Everything is already queued for indexing."
            : `Queued ${queued} material${queued === 1 ? "" : "s"} for re-indexing.`,
        );
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Could not start re-indexing.",
        );
      } finally {
        router.refresh();
      }
    });
  }

  return (
    <Button
      type="button"
      variant="outline"
      className="justify-start"
      onClick={run}
      disabled={pending}
    >
      {pending ? (
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
      ) : (
        <RefreshCcw className="size-4" aria-hidden="true" />
      )}
      {pending ? "Queueing re-index..." : "Rebuild AI chatbot index"}
    </Button>
  );
}
