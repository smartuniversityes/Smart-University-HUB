import { NextResponse } from "next/server";
import { appendFile, stat, readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

/**
 * Dev-only diagnostics: the phone (which we cannot debug remotely) reports what
 * it actually sees, so mobile-only failures become visible on the server.
 * Disabled entirely in production builds so no telemetry is ever shipped.
 */
export function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ ok: false });
  }
  return NextResponse.json({ ok: true });
}

export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ ok: false });
  }
  const logFile = path.join(process.cwd(), "uploads", "diag.log");
  await mkdir(path.dirname(logFile), { recursive: true });

  try {
    const body = await request.json();
    const line =
      JSON.stringify({
        ts: new Date().toISOString(),
        ip: request.headers.get("x-forwarded-for") ?? "",
        ...body,
      }) + "\n";

    await appendFile(logFile, line);

    // Keep the log from growing forever.
    const info = await stat(logFile).catch(() => null);
    if (info && info.size > 1_500_000) {
      const tail = (await readFile(logFile, "utf8")).split("\n").slice(-5000).join("\n");
      await writeFile(logFile, tail);
    }
  } catch {
    return NextResponse.json({ ok: false });
  }
  return NextResponse.json({ ok: true });
}