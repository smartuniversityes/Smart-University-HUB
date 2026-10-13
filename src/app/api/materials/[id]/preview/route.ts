import { createReadStream } from "node:fs";
import { Readable } from "node:stream";
import { getPreviewPath, isSafeStoredName, fileSize } from "@/lib/storage";
import { getPreviewPayload } from "@/models/material";

/**
 * Serves the cached PDF used by the in-browser viewer and the print view.
 * Read-only, so a signed-out visitor can still flip through a lecture.
 */
export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/materials/[id]/preview">,
) {
  const { id } = await ctx.params;

  const material = await getPreviewPayload(id);

  if (!material) {
    return Response.json({ error: "Material not found." }, { status: 404 });
  }
  if (material.previewStatus !== "READY" || !material.previewPath) {
    return Response.json(
      { error: "No preview available yet.", status: material.previewStatus },
      { status: 409 },
    );
  }
  if (!isSafeStoredName(material.previewPath)) {
    return Response.json({ error: "Invalid preview reference." }, { status: 500 });
  }

  const path = getPreviewPath(material.previewPath);

  let size: number;
  try {
    size = await fileSize(path);
  } catch {
    return Response.json(
      { error: "The cached preview is missing from disk." },
      { status: 410 },
    );
  }

  const stream = Readable.toWeb(createReadStream(path)) as ReadableStream<Uint8Array>;

  return new Response(stream, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Length": String(size),
      "Content-Disposition": `inline; filename="${encodeURIComponent(material.title)}.pdf"`,
      // The PDF is regenerated whenever the source changes, so revalidate often.
      "Cache-Control": "private, max-age=0, must-revalidate",
      "X-Content-Type-Options": "nosniff",
    },
  });
}