"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Bot } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ChatPanel } from "@/components/chat/chat-panel";

/**
 * Floating chat launcher shown on every page for signed-in users. The same
 * ChatPanel used on /chat lives inside, in its sidebar-less widget variant, so
 * a student can ask a quick question without leaving the page they are on.
 */
export function ChatWidget({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // The full page already lives at /chat; a floating duplicate would overlap it.
  if (pathname === "/chat") return null;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          type="button"
          size="icon"
          aria-label="Open the study assistant"
          title="Study assistant"
          className={cn(
            "size-12 rounded-full shadow-lg transition-transform hover:scale-105",
            className,
          )}
        >
          <Bot className="size-6" aria-hidden="true" />
        </Button>
      </SheetTrigger>

      <SheetContent
        side="bottom"
        showCloseButton={false}
        className="h-[80dvh] gap-0 overflow-hidden rounded-t-2xl p-0 sm:h-[75dvh]"
      >
        {/* Radix requires a Title/Description pair for a11y; the visible
            heading lives inside the panel's own toolbar. */}
        <SheetHeader className="sr-only">
          <SheetTitle>Study assistant</SheetTitle>
          <SheetDescription>
            Ask questions about your uploaded lecture material.
          </SheetDescription>
        </SheetHeader>
        <ChatPanel variant="widget" className="min-h-0" />
      </SheetContent>
    </Sheet>
  );
}
