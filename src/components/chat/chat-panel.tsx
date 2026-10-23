"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Bot,
  Loader2,
  MessageSquarePlus,
  Send,
  Sparkles,
  Trash2,
  User,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { formatDateTime, relativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ChatTurn, SessionSummary, SourceEvent, StreamEvent } from "@/lib/chat-types";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CitationList } from "@/components/chat/citations";

/**
 * The chat interface itself: conversation history on the left, the streamed
 * answers on the right. Answers arrive as newline-delimited JSON events (see
 * POST /api/chat) so sources can be shown alongside the text as it is typed.
 */

type PendingAssistant = {
  /** Sources announced by the server so far. */
  sources: SourceEvent[];
  text: string;
  error: string | null;
};

type Conversation = {
  sessionId: string | null;
  turns: ChatTurn[];
};

const EMPTY: Conversation = { sessionId: null, turns: [] };

export function ChatPanel({
  initialSessions,
  material = null,
  className,
  variant = "page",
}: {
  initialSessions?: SessionSummary[];
  /** Locks answers to this one file (the "Ask AI" button on material pages). */
  material?: { id: string; title: string; subjectCode: string } | null;
  className?: string;
  /** "page" shows the history sidebar; "widget" fits inside the floating sheet. */
  variant?: "page" | "widget";
}) {
  const [sessions, setSessions] = useState<SessionSummary[]>(initialSessions ?? []);
  const [conversation, setConversation] = useState<Conversation>(EMPTY);
  const [pending, setPending] = useState<PendingAssistant | null>(null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [scope, setScope] = useState(material);

  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  /* --------------------------------------------------------- history */

  const loadSessions = useCallback(async () => {
    try {
      const response = await fetch("/api/chat/sessions");
      if (!response.ok) return;
      const data = (await response.json()) as { sessions: SessionSummary[] };
      setSessions(data.sessions);
    } catch {
      // Offline or a transient failure: keep whatever we already show.
    }
  }, []);

  const openSession = useCallback(async (sessionId: string) => {
    setLoadingHistory(true);
    abortRef.current?.abort();
    try {
      const response = await fetch(`/api/chat/sessions/${sessionId}`);
      if (!response.ok) throw new Error();
      const data = (await response.json()) as { messages: ChatTurn[] };
      setConversation({ sessionId, turns: data.messages });
      setPending(null);
    } catch {
      toast.error("Could not open this conversation.");
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  const startNewChat = useCallback(() => {
    abortRef.current?.abort();
    setConversation(EMPTY);
    setPending(null);
    setInput("");
    textareaRef.current?.focus();
  }, []);

  const deleteSession = useCallback(
    async (sessionId: string) => {
      try {
        const response = await fetch(`/api/chat/sessions/${sessionId}`, {
          method: "DELETE",
        });
        if (!response.ok) throw new Error();
        setSessions((prev) => prev.filter((session) => session.id !== sessionId));
        if (conversation.sessionId === sessionId) {
          setConversation(EMPTY);
          setPending(null);
        }
        toast.success("Conversation deleted.");
      } catch {
        toast.error("Could not delete this conversation.");
      }
    },
    [conversation.sessionId],
  );

  /* --------------------------------------------------------- autoscroll */

  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [conversation, pending, loadingHistory]);

  /* --------------------------------------------------------- sending */

  // Not memoised: it closes over live state and is only invoked from event
  // handlers, so a fresh function each render costs nothing.
  async function send() {
    const message = input.trim();
    if (message.length === 0 || sending) return;

    setInput("");
    setSending(true);
    setPending({ sources: [], text: "", error: null });

    // Optimistic user bubble; the server keeps its own copy for history.
    setConversation((prev) => ({
      sessionId: prev.sessionId,
      turns: [
        ...prev.turns,
        {
          id: `local-${Date.now()}`,
          role: "user",
          content: message,
          citations: null,
          createdAt: new Date().toISOString(),
        },
      ],
    }));

    const controller = new AbortController();
    abortRef.current = controller;

    // Local accumulators mirror the pending state so the final commit after
    // the stream closes does not depend on updater functions with side effects.
    // They live outside `try` so an aborted stream can still commit what it
    // received before the Stop button was pressed.
    let sources: SourceEvent[] = [];
    let answer = "";
    let streamError: string | null = null;
    let announcedSession: { id: string; title: string } | null = null;
    let committed = false;

    // Moves the answer from the live bubble into the conversation. Runs at
    // most once, whether the stream finished or was stopped midway.
    const commit = () => {
      if (committed || answer.trim().length === 0) return;
      committed = true;
      setConversation((prev) => ({
        sessionId: announcedSession?.id ?? prev.sessionId,
        turns: [
          ...prev.turns,
          {
            id: `answer-${Date.now()}`,
            role: "assistant",
            content: answer.trim(),
            citations:
              sources.length > 0
                ? sources.map((source) => ({
                    materialId: source.materialId,
                    title: source.title,
                    subjectCode: source.subjectCode,
                    pageLabel: source.pageLabel,
                    quote: source.quote,
                  }))
                : null,
            createdAt: new Date().toISOString(),
          },
        ],
      }));
    };

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          sessionId: conversation.sessionId ?? undefined,
          materialId: scope?.id,
        }),
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        const data = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(data?.error ?? "The assistant could not be reached.");
      }

      // NDJSON: one JSON event per line, terminated by a newline.
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      const apply = (event: StreamEvent) => {
        if (event.type === "session") {
          announcedSession = { id: event.sessionId, title: event.title };
          setConversation((prev) => ({ ...prev, sessionId: event.sessionId }));
          setSessions((prev) => {
            const rest = prev.filter((session) => session.id !== event.sessionId);
            return [
              { id: event.sessionId, title: event.title, updatedAt: new Date().toISOString() },
              ...rest,
            ];
          });
        } else if (event.type === "source") {
          sources = [...sources, event];
          setPending((prev) => (prev ? { ...prev, sources } : prev));
        } else if (event.type === "delta") {
          answer += event.text;
          setPending((prev) => (prev ? { ...prev, text: answer } : prev));
        } else if (event.type === "error") {
          streamError = event.message;
          setPending((prev) => (prev ? { ...prev, error: event.message } : prev));
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (line.trim().length === 0) continue;
          try {
            apply(JSON.parse(line) as StreamEvent);
          } catch {
            // A torn line at a chunk boundary; the next read completes it.
          }
        }
      }

      // The stream ends after "done": move the finished answer into history.
      commit();
      setPending(null);
      if (streamError && answer.trim().length === 0) {
        // Nothing usable arrived: put the question back so it can be retried.
        setInput(message);
      }
      void loadSessions();
    } catch (error) {
      const aborted = error instanceof Error && error.name === "AbortError";
      if (aborted) {
        // Stop was pressed: the server keeps its own partial copy, and the
        // answer accumulated so far is kept here so the reply is not lost.
        commit();
        setPending(null);
      } else {
        const text =
          error instanceof Error ? error.message : "Something went wrong.";
        setPending((prev) => (prev ? { ...prev, error: text } : null));
        toast.error(text);
        // Keep the question in the input so it is not lost.
        setInput(message);
      }
    } finally {
      setSending(false);
      abortRef.current = null;
    }
  }

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const onKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void send();
    }
  };

  /* --------------------------------------------------------- render */

  const hasTurns = conversation.turns.length > 0 || pending !== null;

  return (
    <div className={cn("flex min-h-0 flex-1", className)}>
      {/* --------------------------------------------------- sidebar */}
      {variant === "page" ? (
        <aside className="hidden w-72 shrink-0 flex-col border-r border-border/60 md:flex">
          <div className="border-b border-border/60 p-3">
            <Button type="button" className="w-full justify-start" variant="outline" onClick={startNewChat}>
              <MessageSquarePlus className="size-4" aria-hidden="true" />
              New conversation
            </Button>
          </div>
          <ScrollArea className="flex-1 px-2 py-2">
            {sessions.length === 0 ? (
              <p className="px-2 py-6 text-center text-xs text-muted-foreground">
                Your conversations will appear here.
              </p>
            ) : (
              <ul className="space-y-1">
                {sessions.map((session) => (
                  <li key={session.id} className="group relative">
                    <button
                      type="button"
                      onClick={() => void openSession(session.id)}
                      className={cn(
                        "w-full rounded-lg px-3 py-2.5 pr-9 text-left text-sm transition-colors",
                        conversation.sessionId === session.id
                          ? "bg-accent text-accent-foreground"
                          : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
                      )}
                      title={`${session.title} — ${formatDateTime(session.updatedAt)}`}
                    >
                      <span className="block truncate">{session.title}</span>
                      <span className="mt-0.5 block text-[11px] opacity-70">
                        {relativeTime(session.updatedAt)}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => void deleteSession(session.id)}
                      aria-label={`Delete conversation: ${session.title}`}
                      className="absolute right-1.5 top-1/2 hidden -translate-y-1/2 rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive group-hover:block focus-visible:block"
                    >
                      <Trash2 className="size-3.5" aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </ScrollArea>
        </aside>
      ) : null}

      {/* --------------------------------------------------- messages */}
      <section className="flex min-w-0 flex-1 flex-col">
        {variant === "widget" ? (
          <div className="flex items-center justify-between border-b border-border/60 px-4 py-2.5">
            <span className="flex items-center gap-2 text-sm font-medium">
              <Bot className="size-4 text-primary" aria-hidden="true" />
              Study assistant
            </span>
            <Button type="button" size="sm" variant="ghost" onClick={startNewChat}>
              <MessageSquarePlus className="size-4" aria-hidden="true" />
              New chat
            </Button>
          </div>
        ) : null}

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6">
          <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
            {!hasTurns ? (
              <EmptyState onPick={(text) => {
                setInput(text);
                textareaRef.current?.focus();
              }} />
            ) : null}

            {conversation.turns.map((turn) => (
              <Message key={turn.id} turn={turn} />
            ))}

            {loadingHistory ? (
              <p className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                Loading conversation...
              </p>
            ) : null}

            {pending ? <PendingMessage pending={pending} sending={sending} /> : null}
          </div>
        </div>

        {/* ------------------------------------------------- composer */}
        <div className="border-t border-border/60 bg-background/60 px-4 py-3 backdrop-blur">
          <div className="mx-auto w-full max-w-3xl">
            {scope ? (
              <div className="mb-2 flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-1.5 text-xs">
                <Sparkles className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate">
                  Only answering from{" "}
                  <span className="font-medium">{scope.title}</span>
                  <span className="text-muted-foreground"> ({scope.subjectCode})</span>
                </span>
                <button
                  type="button"
                  onClick={() => setScope(null)}
                  className="shrink-0 rounded-md p-0.5 text-muted-foreground hover:text-foreground"
                  aria-label="Search all material instead"
                >
                  <X className="size-3.5" aria-hidden="true" />
                </button>
              </div>
            ) : null}
            <div className="flex items-end gap-2">
              <Textarea
                ref={textareaRef}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Ask anything about your lectures... (Enter to send)"
                className="max-h-40 min-h-11 resize-none"
                rows={1}
                disabled={sending}
                aria-label="Your question"
              />
              {sending ? (
                <Button type="button" variant="secondary" onClick={stop} aria-label="Stop answering">
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  Stop
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={() => void send()}
                  disabled={input.trim().length === 0}
                  aria-label="Send question"
                >
                  <Send className="size-4" aria-hidden="true" />
                </Button>
              )}
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              Answers come only from uploaded material and always list their sources.
              Verify anything important in the original file.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Pieces
 * ------------------------------------------------------------------ */

function Message({ turn }: { turn: ChatTurn }) {
  const isUser = turn.role === "user";
  return (
    <div className={cn("flex gap-3", isUser && "flex-row-reverse")}>
      <span
        className={cn(
          "mt-1 grid size-8 shrink-0 place-items-center rounded-full",
          isUser ? "bg-primary/10 text-primary" : "bg-accent text-accent-foreground",
        )}
        aria-hidden="true"
      >
        {isUser ? <User className="size-4" /> : <Bot className="size-4" />}
      </span>
      <div className={cn("min-w-0 max-w-[85%]", isUser && "text-right")}>
        <div
          className={cn(
            "inline-block whitespace-pre-wrap break-words rounded-2xl px-4 py-2.5 text-left text-sm leading-relaxed",
            isUser
              ? "bg-primary text-primary-foreground"
              : "border border-border/60 bg-muted/40",
          )}
        >
          {turn.content}
        </div>
        {!isUser && turn.citations && turn.citations.length > 0 ? (
          <CitationList citations={turn.citations} />
        ) : null}
      </div>
    </div>
  );
}

function PendingMessage({
  pending,
  sending,
}: {
  pending: PendingAssistant;
  sending: boolean;
}) {
  return (
    <div className="flex gap-3">
      <span
        className="mt-1 grid size-8 shrink-0 place-items-center rounded-full bg-accent text-accent-foreground"
        aria-hidden="true"
      >
        <Bot className="size-4" />
      </span>
      <div className="min-w-0 max-w-[85%]">
        {pending.text.length > 0 ? (
          <div className="inline-block whitespace-pre-wrap break-words rounded-2xl border border-border/60 bg-muted/40 px-4 py-2.5 text-sm leading-relaxed">
            {pending.text}
            {sending ? (
              <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse bg-primary align-middle" />
            ) : null}
          </div>
        ) : (
          <p className="flex items-center gap-2 rounded-2xl border border-border/60 bg-muted/40 px-4 py-2.5 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            Searching your material...
          </p>
        )}

        {pending.error ? (
          <p className="mt-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {pending.error}
          </p>
        ) : null}

        {pending.sources.length > 0 ? (
          <CitationList
            citations={pending.sources.map((source) => ({
              materialId: source.materialId,
              title: source.title,
              subjectCode: source.subjectCode,
              pageLabel: source.pageLabel,
              quote: source.quote,
            }))}
          />
        ) : null}
      </div>
    </div>
  );
}

function EmptyState({ onPick }: { onPick: (text: string) => void }) {
  const suggestions = [
    "Explain the lecture on binary trees",
    "Summarise the chapter 3 notes",
    "What topics are covered in last week's slides?",
    "Previous exam questions kya the?",
  ];

  return (
    <div className="flex flex-col items-center px-4 py-10 text-center">
      <span className="grid size-12 place-items-center rounded-2xl bg-primary/10 text-primary">
        <Bot className="size-6" aria-hidden="true" />
      </span>
      <h2 className="mt-4 text-lg font-semibold">Ask your study assistant</h2>
      <p className="mt-1 max-w-md text-sm text-muted-foreground">
        It has read every uploaded lecture, slide and note in the hub. Ask in
        English, اردو or Roman Urdu — answers come with references back to the
        exact material.
      </p>
      <ul className="mt-5 grid w-full max-w-lg gap-2">
        {suggestions.map((text) => (
          <li key={text}>
            <button
              type="button"
              onClick={() => onPick(text)}
              className="w-full rounded-xl border border-border/60 px-4 py-2.5 text-left text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:bg-muted/40 hover:text-foreground"
            >
              {text}
            </button>
          </li>
        ))}
      </ul>
      <p className="mt-6 text-xs text-muted-foreground">
        Nothing indexed yet?{" "}
        <Link href="/materials" className="underline hover:text-foreground">
          Browse the catalogue
        </Link>
        .
      </p>
    </div>
  );
}
