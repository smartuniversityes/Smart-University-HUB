"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Bot, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ChatPanel } from "@/components/chat/chat-panel";

const DEFAULT_WIDTH = 384;
const DEFAULT_HEIGHT = 512;
const MIN_WIDTH = 280;
const MIN_HEIGHT = 320;
/** Space kept free for the launcher and the page edges. */
const EDGE_X = 24;
const EDGE_Y = 104;

/**
 * Small floating assistant anchored to the bottom-right corner. The panel can
 * be resized by dragging its top-left handle (bottom-right stays pinned), and
 * remembers its size for the rest of the session.
 */
export function ChatWidget({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const dragRef = useRef<{
    startX: number;
    startY: number;
    width: number;
    height: number;
  } | null>(null);
  const pathname = usePathname();

  const clamp = useCallback((width: number, height: number) => {
    if (typeof window === "undefined") return { width, height };
    return {
      width: Math.min(Math.max(MIN_WIDTH, width), Math.max(MIN_WIDTH, window.innerWidth - EDGE_X)),
      height: Math.min(Math.max(MIN_HEIGHT, height), Math.max(MIN_HEIGHT, window.innerHeight - EDGE_Y)),
    };
  }, []);

  const openPanel = useCallback(() => {
    if (!size && typeof window !== "undefined") {
      setSize(
        clamp(
          Math.min(DEFAULT_WIDTH, window.innerWidth - EDGE_X),
          Math.min(DEFAULT_HEIGHT, window.innerHeight - EDGE_Y),
        ),
      );
    }
    setOpen(true);
  }, [clamp, size]);

  // Keep the panel inside the viewport when the window shrinks.
  useEffect(() => {
    if (!open) return;
    const onResize = () => {
      setSize((prev) => (prev ? clamp(prev.width, prev.height) : prev));
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [clamp, open]);

  // Escape closes the floating panel.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const startResize = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!size) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      width: size.width,
      height: size.height,
    };
  };

  const resize = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    setSize(
      clamp(
        drag.width + (drag.startX - event.clientX),
        drag.height + (drag.startY - event.clientY),
      ),
    );
  };

  const endResize = () => {
    dragRef.current = null;
  };

  // The full page already lives at /chat; a floating duplicate would overlap it.
  if (pathname === "/chat") return null;

  return (
    <>
      {open ? (
        <div
          role="dialog"
          aria-label="Study assistant"
          style={size ? { width: size.width, height: size.height } : undefined}
          className="fixed bottom-20 right-3 z-50 flex max-h-[calc(100dvh-7rem)] max-w-[calc(100vw-1.5rem)] flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-2xl sm:right-4"
        >
          <div
            role="separator"
            aria-label="Resize assistant"
            aria-orientation="horizontal"
            title="Drag to resize"
            onPointerDown={startResize}
            onPointerMove={resize}
            onPointerUp={endResize}
            onPointerCancel={endResize}
            className="absolute left-0 top-0 z-10 size-5 cursor-nwse-resize touch-none"
          >
            <span
              className="absolute left-1 top-1 size-2 rounded-tl-sm border-l border-t border-muted-foreground/50"
              aria-hidden="true"
            />
          </div>
          <ChatPanel
            variant="widget"
            className="min-h-0"
            onClose={() => setOpen(false)}
          />
        </div>
      ) : null}

      <Button
        type="button"
        size="icon"
        onClick={() => (open ? setOpen(false) : openPanel())}
        aria-label={open ? "Close the study assistant" : "Open the study assistant"}
        aria-expanded={open}
        title="Study assistant"
        className={cn(
          "fixed bottom-5 right-3 z-40 size-11 rounded-full shadow-lg transition-transform hover:scale-105 sm:right-4",
          className,
        )}
      >
        {open ? (
          <X className="size-5" aria-hidden="true" />
        ) : (
          <Bot className="size-5" aria-hidden="true" />
        )}
      </Button>
    </>
  );
}
