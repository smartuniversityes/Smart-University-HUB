import { getRequestUser } from "@/lib/auth";
import { listChatSessions } from "@/models/chat";

/** Lists the signed-in user's conversations, newest first. */
export async function GET() {
  const user = await getRequestUser();
  if (!user) {
    return Response.json({ error: "Sign in to see your conversations." }, { status: 401 });
  }

  const sessions = await listChatSessions(user.id);
  return Response.json({ sessions });
}
