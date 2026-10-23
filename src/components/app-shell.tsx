import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Diagnostics } from "@/components/diagnostics";
import { ChatWidgetLauncher } from "@/components/chat/chat-widget-launcher";

/**
 * Shared chrome for every page. The header is server-rendered so it can read
 * the session, while the interactive pieces inside it are client components.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex min-h-full flex-col">
        <SiteHeader />
        <main className="flex-1">{children}</main>
        <SiteFooter />
        <Toaster position="bottom-right" richColors closeButton />
        <Diagnostics />
        {/* Floating study assistant; renders nothing when signed out or on /chat. */}
        <ChatWidgetLauncher />
      </div>
    </TooltipProvider>
  );
}
