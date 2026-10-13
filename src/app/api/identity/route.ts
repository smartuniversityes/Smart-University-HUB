import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";

export const dynamic = "force-dynamic";

/**
 * A page that works even with JavaScript completely disabled. It reports the
 * device's user-agent (logged server-side) and shows a plain marker that
 * becomes "JS-WORKS" only if scripts actually execute. This tells us whether a
 * no-interaction phone is a cache problem or a JavaScript problem.
 */
export async function GET(request: Request) {
  const ua = request.headers.get("user-agent") ?? "unknown";
  const logFile = path.join(process.cwd(), "uploads", "diag.log");
  await mkdir(path.dirname(logFile), { recursive: true });
  await appendFile(
    logFile,
    JSON.stringify({
      ts: new Date().toISOString(),
      ip: request.headers.get("x-forwarded-for") ?? "",
      type: "identity-probe",
      ua,
      secChUa: request.headers.get("sec-ch-ua") ?? null,
      secChMobile: request.headers.get("sec-ch-ua-mobile") ?? null,
    }) + "\n",
  );

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Phone check</title>
<style>
  body { font-family: system-ui, sans-serif; margin: 0; padding: 24px; color: #1f2937; background: #f9fafb; }
  pre  { background: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px; overflow-x: auto; }
  .ok  { font-size: 20px; font-weight: 700; margin-top: 16px; }
  .yes { color: #15803d; } .no { color: #b91c1c; }
</style>
</head>
<body>
  <p>Your browser:</p>
  <pre>${ua.replace(/[<>&]/g, "")}</pre>
  <p class="ok">JavaScript test -> <span id="js">NO-JS</span></p>
  <script>document.getElementById("js").textContent = "JS-WORKS";</script>
</body>
</html>`;

  return new Response(html, {
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  });
}