import { enqueuePreview } from "@/lib/preview-queue";
import { getFileKind } from "@/lib/file-types";
import { getConvertTarget } from "@/models/material";

/**
 * Asks for a PDF to be generated for a material. Returns as soon as the job is
 * queued; the client polls `/status` and then loads `/preview`.
 */
export async function POST(
  _request: Request,
  ctx: RouteContext<"/api/materials/[id]/preview">,
) {
  const { id } = await ctx.params;

  const material = await getConvertTarget(id);
  if (!material) {
    return Response.json({ error: "Material not found." }, { status: 404 });
  }

  const kind = getFileKind(material.extension);
  if (!kind || kind.preview !== "convert") {
    return Response.json(
      { error: "This file type does not need conversion." },
      { status: 400 },
    );
  }

  if (material.previewStatus === "READY") {
    return Response.json({ status: "READY" });
  }
  if (material.previewStatus === "PENDING" || material.previewStatus === "RUNNING") {
    return Response.json({ status: material.previewStatus });
  }

  await enqueuePreview(material.id);
  return Response.json({ status: "PENDING" });
}