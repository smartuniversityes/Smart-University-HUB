import type { Metadata } from "next";
import { Bot } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { listChatSessions } from "@/models/chat";
import { getMaterialDetail } from "@/models/material";
import { ChatPanel } from "@/components/chat/chat-panel";

export const metadata: Metadata = { title: "Study assistant" };
export const dynamic = "force-dynamic";

/**
 * Students ask questions here. The panel renders client-side so answers can
 * stream in, but the session list and the access check are resolved on the
 * server: only signed-in users reach this page (also enforced in proxy.ts).
 *
 * `?material=<id>` (from the "Ask AI" button on a material page) scopes every
 * answer to that one file until the student clears it.
 */
export default async function ChatPage({
  searchParams,
}: PageProps<"/chat">) {
  const user = await requireUser();
  const params = await searchParams;

  const requestedMaterial =
    typeof params.material === "string" ? params.material : null;
  const material = requestedMaterial ? await getMaterialDetail(requestedMaterial) : null;

  const sessions = await listChatSessions(user.id);

  return (
    <div className="flex h-[calc(100dvh-4rem)] min-h-[540px] flex-col">
      <div className="flex items-center gap-3 border-b border-border/60 px-4 py-3 sm:px-6">
        <span className="grid size-9 place-items-center rounded-xl bg-primary/10 text-primary">
          <Bot className="size-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h1 className="text-base font-semibold leading-tight tracking-tight">
            Study assistant
          </h1>
          <p className="truncate text-xs text-muted-foreground">
            Welcome, {user.name.split(" ")[0]} — answers from your uploaded material
          </p>
        </div>
      </div>
      <ChatPanel
        initialSessions={sessions}
        material={
          material
            ? { id: material.id, title: material.title, subjectCode: material.subject.code }
            : null
        }
      />
    </div>
  );
}
