import { getCurrentUser } from "@/lib/auth";
import { isTextType } from "@/lib/file-types";
import { getOriginalPath, isSafeStoredName, fileSize } from "@/lib/storage";
import { getContentPayload } from "@/models/material";

/** Text formats are rendered in the page, so only the text is returned. */
const MAX_TEXT_BYTES = 512 * 1024;

export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/materials/[id]/content">,
) {
  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ error: "Sign in to view this material." }, { status: 401 });
  }

  const { id } = await ctx.params;

  const material = await getContentPayload(id);
  if (!material) {
    return Response.json({ error: "Material not found." }, { status: 404 });
  }
  if (!isTextType(material.extension)) {
    return Response.json(
      { error: "This file is not a text format." },
      { status: 400 },
    );
  }
  if (material.storedName.startsWith("sample-")) {
    return Response.json(
      { error: "This is a sample record. Upload a real file to preview it." },
      { status: 409 },
    );
  }
  if (!isSafeStoredName(material.storedName)) {
    return Response.json({ error: "Invalid file reference." }, { status: 500 });
  }

  const path = getOriginalPath(material.storedName);

  let size: number;
  try {
    size = await fileSize(path);
  } catch {
    return Response.json({ error: "The stored file is missing." }, { status: 410 });
  }

  const truncated = size > MAX_TEXT_BYTES;
  const { readFile } = await import("node:fs/promises");
  let text: string;
  try {
    const buffer = await readFile(path, truncated ? { encoding: "utf8" } : undefined);
    text = typeof buffer === "string" ? buffer : buffer.toString("utf8");
  } catch {
    return Response.json({ error: "The file could not be read." }, { status: 410 });
  }

  if (truncated) {
    text = text.slice(0, MAX_TEXT_BYTES);
  }

  return Response.json(
    {
      title: material.title,
      extension: material.extension,
      sizeBytes: size,
      truncated,
      text,
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}

export const dynamic = "force-dynamic";