import { createReadStream } from "node:fs";
import { Readable } from "node:stream";
import { getCurrentUser } from "@/lib/auth";
import { getOriginalPath, isSafeStoredName, fileSize } from "@/lib/storage";
import { getDownloadPayload } from "@/models/material";
import { recordDownload } from "@/models/download";

/**
 * Streams the original uploaded file. Requires a signed-in user, records the
 * download, and sends the professor's original filename so the file opens
 * exactly as it was created.
 */
export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/materials/[id]/download">,
) {
  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ error: "Sign in to download this material." }, { status: 401 });
  }

  const { id } = await ctx.params;

  const material = await getDownloadPayload(id);
  if (!material) {
    return Response.json({ error: "Material not found." }, { status: 404 });
  }

  // Seed rows describe real lectures but have no file behind them yet.
  if (material.storedName.startsWith("sample-")) {
    return Response.json(
      { error: "This is a sample record. Upload a real file to download it." },
      { status: 409 },
    );
  }

  if (!isSafeStoredName(material.storedName)) {
    return Response.json({ error: "Stored file reference is invalid." }, { status: 500 });
  }

  const path = getOriginalPath(material.storedName);

  let size: number;
  try {
    size = await fileSize(path);
  } catch {
    return Response.json(
      { error: "The stored file is missing from disk." },
      { status: 410 },
    );
  }

  // Fire-and-forget analytics: a failure here must not block the download.
  void (async () => {
    try {
      await recordDownload(material.id, user.id);
    } catch (error) {
      console.error("Failed to record download", error);
    }
  })();

  const stream = Readable.toWeb(createReadStream(path)) as ReadableStream<Uint8Array>;
  const encodedName = encodeURIComponent(material.originalName);

  return new Response(stream, {
    headers: {
      "Content-Type": material.mimeType || "application/octet-stream",
      "Content-Length": String(size),
      // RFC 5987 form carries the real name; the plain fallback is for old clients.
      "Content-Disposition": `attachment; filename="download.${material.originalName.split(".").pop() ?? "bin"}"; filename*=UTF-8''${encodedName}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}