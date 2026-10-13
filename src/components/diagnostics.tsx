"use client";

import { useEffect } from "react";

/**
 * Dev-only client reporter. It tells the server what the real device is doing:
 * - a load beacon with browser/screen details
 * - any uncaught error, rejected promise or console.error
 * - the first taps, with what was hit
 * It is a no-op in production builds.
 */
export function Diagnostics() {
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;

    let deviceId = "";
    try {
      deviceId = window.localStorage.getItem("diag-id") ?? "";
      if (!deviceId) {
        deviceId = Math.random().toString(36).slice(2, 10);
        window.localStorage.setItem("diag-id", deviceId);
      }
    } catch {
      /* storage may be unavailable */
    }

    const send = (payload: Record<string, unknown>) => {
      try {
        fetch("/api/diag", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ deviceId, ...payload }),
        }).catch(() => {});
      } catch {
        /* ignore */
      }
    };

    send({
      type: "load",
      ua: navigator.userAgent,
      w: window.innerWidth,
      h: window.innerHeight,
      dpr: window.devicePixelRatio,
      touch: "ontouchstart" in window,
      online: navigator.onLine,
      storageOk: (() => {
        try {
          window.localStorage.setItem("__t", "1");
          window.localStorage.removeItem("__t");
          return true;
        } catch {
          return false;
        }
      })(),
      hydrateMarker: document.querySelector('[data-slot="button"]') !== null,
    });

    let reported = 0;
    const reportError = (detail: Record<string, unknown>) => {
      if (reported++ >= 12) return;
      send({ type: "error", ...detail });
    };

    const onError = (event: ErrorEvent) =>
      reportError({ kind: "window.onerror", message: event.message, file: event.filename, line: event.lineno });
    const onRejection = (event: PromiseRejectionEvent) =>
      reportError({ kind: "unhandledrejection", message: String(event.reason) });
    const onConsoleError = (...args: unknown[]) => {
      if (reported >= 12) return;
      // Some expected dev noise (e.g. favicon 404) is filtered out.
      const text = args.map((a) => (typeof a === "string" ? a : a instanceof Error ? a.message : "")).join(" ");
      if (/favicon|Download the React DevTools|Consider adding an error boundary/i.test(text)) return;
      reportError({ kind: "console.error", text });
    };
    const originalError = console.error;
    try {
      console.error = (...args: unknown[]) => {
        onConsoleError(...args);
        originalError.apply(console, args);
      };
    } catch {
      /* ignore */
    }
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);

    let clicks = 0;
    const onClick = (event: PointerEvent) => {
      if (clicks++ >= 12) return;
      const target = event.target as HTMLElement | null;
      send({
        type: "click",
        tag: target?.tagName,
        cls: (target?.getAttribute("class") ?? "").slice(0, 100),
        aria: target?.getAttribute("aria-label") ?? target?.getAttribute("data-slot") ?? "",
        text: (target?.textContent ?? "").trim().slice(0, 40),
      });
    };
    window.addEventListener("pointerdown", onClick, true);

    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
      window.removeEventListener("pointerdown", onClick, true);
      try {
        console.error = originalError;
      } catch {
        /* ignore */
      }
    };
  }, []);

  return null;
}