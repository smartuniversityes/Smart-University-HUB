/**
 * Shapes shared by the chat API routes (server) and the chat components
 * (client). Kept out of models/chat.ts because that module is `server-only`
 * and the browser components must be able to import it.
 */

export type Citation = {
  materialId: string;
  title: string;
  subjectCode: string;
  pageLabel: string | null;
  quote: string;
};

export type SessionSummary = {
  id: string;
  title: string;
  updatedAt: string;
};

export type ChatTurn = {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations: Citation[] | null;
  createdAt: string;
};

/**
 * One newline-delimited JSON event from POST /api/chat.
 */
export type StreamEvent =
  | { type: "session"; sessionId: string; title: string }
  | {
      type: "source";
      index: number;
      materialId: string;
      title: string;
      subjectCode: string;
      pageLabel: string | null;
      quote: string;
    }
  | { type: "delta"; text: string }
  | { type: "done"; messageId: string }
  | { type: "error"; message: string };

/** A citation as it arrives over the wire (adds the bracket number). */
export type SourceEvent = Extract<StreamEvent, { type: "source" }>;
