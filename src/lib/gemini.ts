import "server-only";

/**
 * Thin client for Google's Generative Language REST API. The official SDK is
 * not used because the app only needs two calls (embed + streamed chat) and a
 * plain fetch keeps the dependency tree and the bundle small.
 *
 * Everything here talks directly to the public REST endpoints with the API key
 * from GEMINI_API_KEY. The key never reaches the browser: every call is made
 * from a route handler or a server action.
 */

const API_BASE = "https://generativelanguage.googleapis.com/v1beta";

export const CHAT_MODEL = process.env.GEMINI_CHAT_MODEL || "gemini-3.5-flash";
export const EMBED_MODEL = process.env.GEMINI_EMBED_MODEL || "gemini-embedding-001";

/** Gemini embedding dimensions (gemini-embedding-001 = 3072). */
export const EMBED_DIMENSIONS = 3072;

export function geminiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY?.trim());
}

export class GeminiError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = "GeminiError";
  }
}

function headers(): HeadersInit {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) {
    throw new GeminiError(
      "GEMINI_API_KEY is missing. Add it to .env to enable the study chatbot.",
    );
  }
  return { "Content-Type": "application/json", "x-goog-api-key": key };
}

/** Turns a non-2xx response into a message a human can act on. */
async function toGeminiError(response: Response): Promise<GeminiError> {
  let detail = "";
  try {
    const body = (await response.json()) as {
      error?: { message?: string; status?: string };
    };
    detail = body.error?.message ?? body.error?.status ?? "";
  } catch {
    // Non-JSON error body; the status line is all we get.
  }
  if (response.status === 400 && detail.toLowerCase().includes("api key")) {
    return new GeminiError("GEMINI_API_KEY was rejected by Google. Check the key.", 400);
  }
  if (response.status === 429) {
    return new GeminiError(
      "The Gemini free tier is rate-limited right now. Wait a minute and try again.",
      429,
    );
  }
  if (response.status === 503) {
    return new GeminiError(
      "Gemini is at high demand right now. Please try again in a few seconds.",
      503,
    );
  }
  return new GeminiError(
    `Gemini request failed (${response.status})${detail ? `: ${detail}` : ""}`,
    response.status,
  );
}

/**
 * The free tier answers 503 "high demand" at random. Those clear within a few
 * seconds, so one POST is retried with a short backoff before giving up. Only
 * the request is retried — never a stream that already started producing text.
 */
const OVERLOAD_RETRIES = 2;

async function postWithRetry(
  url: string,
  body: string,
  signal?: AbortSignal,
): Promise<Response> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= OVERLOAD_RETRIES; attempt += 1) {
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    if (attempt > 0) {
      await new Promise((resolve) => setTimeout(resolve, attempt * 1500));
    }
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: headers(),
        body,
        signal,
      });
      if (response.status !== 503) return response;
      lastError = await toGeminiError(response);
    } catch (error) {
      // Never swallow a client-initiated abort as a retryable failure.
      if (signal?.aborted) throw error;
      lastError = error;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new GeminiError("Gemini is unreachable right now. Try again shortly.", 503);
}

/* ------------------------------------------------------------------ *
 * Embeddings
 * ------------------------------------------------------------------ */

/**
 * Embeds a batch of texts. Batching matters: the indexing pass embeds every
 * chunk of every material, and one batched call per ~20 chunks keeps the job
 * inside the free tier instead of hammering the API chunk by chunk.
 */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];

  const response = await postWithRetry(
    `${API_BASE}/models/${EMBED_MODEL}:batchEmbedContents`,
    JSON.stringify({
      requests: texts.map((text) => ({
        model: `models/${EMBED_MODEL}`,
        content: { parts: [{ text }] },
      })),
    }),
  );

  if (!response.ok) throw await toGeminiError(response);

  const data = (await response.json()) as { embeddings?: Array<{ values: number[] }> };
  const embeddings = data.embeddings?.map((item) => item.values) ?? [];
  if (embeddings.length !== texts.length) {
    throw new GeminiError(
      `Expected ${texts.length} embeddings, got ${embeddings.length}.`,
    );
  }
  return embeddings;
}

export async function embedText(text: string): Promise<number[]> {
  const [vector] = await embedTexts([text]);
  return vector;
}

/* ------------------------------------------------------------------ *
 * Chat (streaming)
 * ------------------------------------------------------------------ */

export type ChatTurn = { role: "user" | "model"; text: string };

export type StreamChatOptions = {
  systemInstruction: string;
  turns: ChatTurn[];
  signal?: AbortSignal;
};

/**
 * Streams a chat completion. Yields raw text deltas as the model produces
 * them, so the UI can render the answer while it is still being written.
 */
export async function* streamChat(options: StreamChatOptions): AsyncGenerator<string> {
  const { systemInstruction, turns, signal } = options;

  const response = await postWithRetry(
    `${API_BASE}/models/${CHAT_MODEL}:streamGenerateContent?alt=sse`,
    JSON.stringify({
      systemInstruction: { parts: [{ text: systemInstruction }] },
      contents: turns.map((turn) => ({
        role: turn.role,
        parts: [{ text: turn.text }],
      })),
      generationConfig: { temperature: 0.3, maxOutputTokens: 2048 },
    }),
    signal,
  );

  if (!response.ok) throw await toGeminiError(response);
  if (!response.body) throw new GeminiError("Gemini returned an empty response body.");

  // The endpoint streams server-sent events: "data: {...}" lines, each holding
  // one JSON chunk with a text delta in candidates[0].content.parts. Google
  // terminates events with a CRLF blank line ("\r\n\r\n"), so the separator
  // match below accepts both LF and CRLF styles.
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  /** Collects the answer texts carried by one complete SSE event. */
  const textsOf = (event: string): string[] => {
    const texts: string[] = [];
    for (const line of event.split(/\r?\n/)) {
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      try {
        const parsed = JSON.parse(payload) as {
          candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
        };
        const parts = parsed.candidates?.[0]?.content?.parts ?? [];
        for (const part of parts) {
          if (typeof part.text === "string" && part.text.length > 0) {
            texts.push(part.text);
          }
        }
      } catch {
        // A malformed SSE frame should not kill the whole answer.
      }
    }
    return texts;
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const events = buffer.split(/\r?\n\r?\n/);
      buffer = events.pop() ?? "";

      for (const event of events) {
        for (const text of textsOf(event)) yield text;
      }
    }
    // A final event without a trailing blank line would otherwise be dropped.
    for (const text of textsOf(buffer)) yield text;
  } finally {
    reader.releaseLock();
  }
}
