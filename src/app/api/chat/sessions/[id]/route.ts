import { getRequestUser } from "@/lib/auth";
import { deleteChatSession, listChatMessages } from "@/models/chat";

/** Reads one conversation's messages (owner only). */
export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/chat/sessions/[id]">,
) {
  const user = await getRequestUser();
  if (!user) {
    return Response.json({ error: "Sign in to read conversations." }, { status: 401 });
  }

  const { id } = await ctx.params;
  const messages = await listChatMessages(user.id, id);
  return Response.json({ messages });
}

/** Deletes a conversation and its messages (owner only). */
export async function DELETE(
  _request: Request,
  ctx: RouteContext<"/api/chat/sessions/[id]">,
) {
  const user = await getRequestUser();
  if (!user) {
    return Response.json({ error: "Sign in to manage conversations." }, { status: 401 });
  }

  const { id } = await ctx.params;
  const deleted = await deleteChatSession(user.id, id);
  if (!deleted) {
    return Response.json({ error: "Conversation not found." }, { status: 404 });
  }
  return Response.json({ ok: true });
}
