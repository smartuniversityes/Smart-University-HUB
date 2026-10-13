import { queueDepth } from "@/lib/preview-queue";
import { getStatusPayload } from "@/models/material";

/** Polled by the preview panel while a conversion is in flight. */
export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/materials/[id]/preview/status">,
) {
  const { id } = await ctx.params;

  const material = await getStatusPayload(id);
  if (!material) {
    return Response.json({ error: "Material not found." }, { status: 404 });
  }

  return Response.json({
    status: material.previewStatus,
    error: material.previewStatus === "FAILED" ? material.previewError : null,
    engine: material.previewEngine,
    updatedAt: material.updatedAt,
    queue: queueDepth(),
  });
}