import { z } from "zod";
import { getRequestUser } from "@/lib/auth";
import { GeminiError, geminiConfigured, streamChat, type ChatTurn as GeminiTurn } from "@/lib/gemini";
import { buildSystemPrompt, hasAnyIndexedChunks, retrieve } from "@/lib/rag";
import {
  createChatSession,
  deriveTitle,
  findOwnedSession,
  loadRecentTurns,
  makeQuote,
  saveAssistantMessage,
  saveUserMessage,
  type Citation,
} from "@/models/chat";

/**
 * Answers one student question as a stream of newline-delimited JSON events
 * (readable with `response.body.getReader()` — no extra EventSource library):
 *
 *   {"type":"session","sessionId":"...","title":"..."}   once, on every turn
 *   {"type":"source","index":1,"materialId":"..."}       for each excerpt handed to the model
 *   {"type":"delta","text":"..."}                        answer text as it is generated
 *   {"type":"done","messageId":"..."}                    answer finished and saved
 *   {"type":"error","message":"..."}                     something went wrong
 *
 * Citations are the excerpts the server actually sent to Gemini (not markers
 * the model may or may not write), so the sources shown in the UI are always
 * real chunks of real uploaded material.
 */

const MAX_QUESTION_CHARS = 2000;
/** Turns of history re-sent for follow-up context. */
const HISTORY_TURNS = 12;

const bodySchema = z.object({
  message: z.string().trim().min(1, "Ask a question first.").max(MAX_QUESTION_CHARS),
  sessionId: z.string().min(1).max(64).optional(),
  /** Restrict retrieval to one material (the "Ask AI" button on its page). */
  materialId: z.string().min(1).max(64).optional(),
});

type StreamEvent =
  | { type: "session"; sessionId: string; title: string }
  | { type: "source"; index: number; materialId: string; title: string; subjectCode: string; pageLabel: string | null; quote: string }
  | { type: "delta"; text: string }
  | { type: "done"; messageId: string }
  | { type: "error"; message: string };

export async function POST(request: Request) {
  const user = await getRequestUser();
  if (!user) {
    return Response.json({ error: "Sign in to ask the study assistant." }, { status: 401 });
  }

  if (!geminiConfigured()) {
    return Response.json(
      {
        error:
          "The AI assistant is not configured yet: set GEMINI_API_KEY in the server's .env file.",
      },
      { status: 503 },
    );
  }

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await request.json());
  } catch (error) {
    const message =
      error instanceof z.ZodError ? error.issues[0]?.message ?? "Invalid request." : "Invalid request.";
    return Response.json({ error: message }, { status: 400 });
  }

  // Resolve or create the conversation before streaming anything.
  let sessionId = body.sessionId;
  let title = deriveTitle(body.message);

  if (sessionId) {
    const session = await findOwnedSession(user.id, sessionId);
    if (!session) {
      return Response.json({ error: "Conversation not found." }, { status: 404 });
    }
    title = session.title;
  } else {
    const session = await createChatSession(user.id, title);
    sessionId = session.id;
  }

  const ownedSessionId = sessionId;

  await saveUserMessage(ownedSessionId, body.message);

  // Retrieval needs the question embedded; run it before opening the stream so
  // errors come back as a normal HTTP status the client can show.
  let citations: Citation[];
  let systemPrompt: string;

  try {
    const hasMaterial = await hasAnyIndexedChunks();
    const chunks = hasMaterial ? await retrieve(body.message, body.materialId) : [];
    citations = chunks.map((chunk) => ({
      materialId: chunk.materialId,
      title: chunk.title,
      subjectCode: chunk.subjectCode,
      pageLabel: chunk.pageLabel,
      quote: makeQuote(chunk.content),
    }));
    systemPrompt = buildSystemPrompt(chunks, Boolean(body.materialId));
  } catch (error) {
    const message =
      error instanceof GeminiError ? error.message : "Could not search the study material.";
    return Response.json({ error: message }, { status: 502 });
  }

  const history = await loadRecentTurns(ownedSessionId, HISTORY_TURNS);

  const encoder = new TextEncoder();
  const aborted = new AbortController();
  request.signal.addEventListener?.("abort", () => aborted.abort(), { once: true });

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: StreamEvent) => {
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        } catch {
          // Client went away mid-answer; the loop below stops via abort.
        }
      };

      send({ type: "session", sessionId: ownedSessionId, title });
      citations.forEach((citation, index) => {
        send({
          type: "source",
          index: index + 1,
          materialId: citation.materialId,
          title: citation.title,
          subjectCode: citation.subjectCode,
          pageLabel: citation.pageLabel,
          quote: citation.quote,
        });
      });

      const turns: GeminiTurn[] = history
        .slice(0, -1) // drop the just-saved user message; it is appended below
        .map((turn) => ({
          role: turn.role === "assistant" ? "model" : "user",
          text: turn.content,
        }));
      turns.push({ role: "user", text: body.message });

      let answer = "";

      try {
        for await (const delta of streamChat({
          systemInstruction: systemPrompt,
          turns,
          signal: aborted.signal,
        })) {
          answer += delta;
          send({ type: "delta", text: delta });
        }
      } catch (error) {
        console.error("[chat] streamChat failed", {
          model: process.env.GEMINI_CHAT_MODEL,
          aborted: aborted.signal.aborted,
          error: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
        });
        if (!aborted.signal.aborted) {
          const message =
            error instanceof GeminiError
              ? error.message
              : "The assistant could not answer right now. Try again.";
          send({ type: "error", message });
        }
        // A partial answer is still saved so the history is not a dead end.
      }

      try {
        if (answer.trim().length > 0) {
          const saved = await saveAssistantMessage(ownedSessionId, answer.trim(), citations);
          send({ type: "done", messageId: saved.id });
        } else if (!aborted.signal.aborted) {
          send({ type: "error", message: "The assistant returned an empty answer. Try again." });
        }
      } catch {
        send({ type: "error", message: "The answer could not be saved to your history." });
      }

      try {
        controller.close();
      } catch {
        // Already closed by the client disconnecting.
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Accel-Buffering": "no",
    },
  });
}
