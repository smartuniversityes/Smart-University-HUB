import { getCurrentUser } from "@/lib/auth";
import { ChatWidget } from "@/components/chat/chat-widget";

/**
 * Server-side gate for the floating assistant: signed-out visitors never load
 * the chat bundle at all. The widget itself hides on /chat, where the full
 * interface already occupies the page.
 */
export async function ChatWidgetLauncher() {
  const user = await getCurrentUser();
  if (!user) return null;
  return <ChatWidget className="fixed bottom-5 right-5 z-40" />;
}
