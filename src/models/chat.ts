import "server-only";
import { prisma } from "@/lib/prisma";

/**
 * Chat history persistence: sessions group a conversation, messages store each
 * turn, and assistant messages keep the citations shown next to the answer as
 * JSON so history can be re-read exactly as it was delivered.
 */

export type Citation = {
  materialId: string;
  title: string;
  subjectCode: string;
  pageLabel: string | null;
  quote: string;
};

export type ChatSessionSummary = {
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

const CITATION_QUOTE_CHARS = 220;

export function makeQuote(content: string): string {
  const flat = content.replace(/\s+/g, " ").trim();
  if (flat.length <= CITATION_QUOTE_CHARS) return flat;
  return `${flat.slice(0, CITATION_QUOTE_CHARS - 1)}…`;
}

/** Session titles come from the first question, truncated to a sidebar width. */
export function deriveTitle(message: string): string {
  const flat = message.replace(/\s+/g, " ").trim();
  return flat.length > 60 ? `${flat.slice(0, 59)}…` : flat || "New conversation";
}

export async function createChatSession(userId: string, title: string) {
  return prisma.chatSession.create({ data: { userId, title } });
}

export async function listChatSessions(userId: string): Promise<ChatSessionSummary[]> {
  const sessions = await prisma.chatSession.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    take: 50,
    select: { id: true, title: true, updatedAt: true },
  });
  return sessions.map((session) => ({
    id: session.id,
    title: session.title,
    updatedAt: session.updatedAt.toISOString(),
  }));
}

/** Returns the session only when it belongs to the given user. */
export async function findOwnedSession(userId: string, sessionId: string) {
  return prisma.chatSession.findFirst({
    where: { id: sessionId, userId },
    select: { id: true, title: true },
  });
}

export async function listChatMessages(userId: string, sessionId: string): Promise<ChatTurn[]> {
  const session = await prisma.chatSession.findFirst({
    where: { id: sessionId, userId },
    select: { id: true },
  });
  if (!session) return [];

  const messages = await prisma.chatMessage.findMany({
    where: { sessionId },
    orderBy: { createdAt: "asc" },
    select: { id: true, role: true, content: true, citations: true, createdAt: true },
  });

  return messages.map((message) => ({
    id: message.id,
    role: message.role === "assistant" ? "assistant" : "user",
    content: message.content,
    citations: parseCitations(message.citations),
    createdAt: message.createdAt.toISOString(),
  }));
}

export function parseCitations(raw: string | null): Citation[] | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return null;
    return parsed as Citation[];
  } catch {
    return null;
  }
}

/** Last N turns, oldest first — enough context for follow-up questions. */
export async function loadRecentTurns(
  sessionId: string,
  limit: number,
): Promise<Array<{ role: "user" | "assistant"; content: string }>> {
  const messages = await prisma.chatMessage.findMany({
    where: { sessionId },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: { role: true, content: true },
  });
  return messages
    .reverse()
    .map((message) => ({
      role: message.role === "assistant" ? "assistant" : "user",
      content: message.content,
    }));
}

export async function saveUserMessage(sessionId: string, content: string) {
  return prisma.chatMessage.create({
    data: { sessionId, role: "user", content },
    select: { id: true, createdAt: true },
  });
}

export async function saveAssistantMessage(
  sessionId: string,
  content: string,
  citations: Citation[],
) {
  return prisma.chatMessage.create({
    data: {
      sessionId,
      role: "assistant",
      content,
      citations: citations.length > 0 ? JSON.stringify(citations) : null,
    },
    select: { id: true, createdAt: true },
  });
}

export async function deleteChatSession(userId: string, sessionId: string): Promise<boolean> {
  const session = await prisma.chatSession.findFirst({
    where: { id: sessionId, userId },
    select: { id: true },
  });
  if (!session) return false;
  await prisma.chatSession.delete({ where: { id: session.id } });
  return true;
}
