"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { enqueueIndexing } from "@/lib/index-queue";
import { saveOriginal, writePreview, deleteOriginal, deletePreview } from "@/lib/storage";
import {
  MAX_UPLOAD_BYTES,
  getExtension,
  getFileKind,
  isAllowedExtension,
} from "@/lib/file-types";
import { formatBytes } from "@/lib/format";
import { findSubjectById } from "@/models/subject";
import {
  createMaterial,
  deleteMaterialById,
  getMaterialForManage,
  updateMaterialFields,
} from "@/models/material";

export type UploadState = {
  error?: string;
  fieldErrors?: Record<string, string>;
};

const fieldsSchema = z.object({
  title: z.string().trim().min(3, "Give the material a title").max(160),
  description: z.string().trim().max(2000).optional(),
  subjectId: z.string().min(1, "Choose a subject"),
});

/**
 * Writes the uploaded file to disk, then records it. A PDF preview is just a copy
 * of the original so those are READY immediately, and office formats are left
 * unconverted until somebody opens them, which keeps uploads fast.
 */
export async function uploadMaterial(
  _prev: UploadState,
  formData: FormData,
): Promise<UploadState> {
  const user = await requireRole("PROFESSOR", "ADMIN");

  const parsed = fieldsSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description") || undefined,
    subjectId: formData.get("subjectId"),
  });

  if (!parsed.success) {
    return {
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string>,
    };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { fieldErrors: { file: "Choose a file to upload" } };
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return {
      fieldErrors: {
        file: `That file is ${formatBytes(file.size)}. The limit is ${formatBytes(MAX_UPLOAD_BYTES)}.`,
      },
    };
  }

  const extension = getExtension(file.name);
  if (!isAllowedExtension(extension)) {
    return { fieldErrors: { file: `Files of type .${extension || "?"} are not allowed` } };
  }
  const kind = getFileKind(extension)!;

  const subject = await findSubjectById(parsed.data.subjectId);
  if (!subject) {
    return { fieldErrors: { subjectId: "That subject no longer exists" } };
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  let storedName: string;
  let previewPath: string | null = null;
  try {
    storedName = await saveOriginal(buffer, extension);
    if (kind.preview === "pdf") {
      previewPath = await writePreview(buffer);
    }
  } catch (error) {
    console.error("Failed to store upload", error);
    return { error: "The file could not be saved to disk. Please try again." };
  }

  try {
    const material = await createMaterial({
      title: parsed.data.title,
      description: parsed.data.description || null,
      originalName: file.name,
      storedName,
      extension,
      mimeType: kind.mime,
      sizeBytes: file.size,
      previewStatus: kind.preview === "pdf" || kind.preview === "text" ? "READY" : "NONE",
      previewPath,
      previewEngine: previewPath ? "original" : null,
      subjectId: subject.id,
      professorId: user.id,
    });

    revalidatePath("/materials");
    revalidatePath("/professor/materials");

    // Start indexing for the chatbot in the background: extraction plus
    // embedding takes seconds, and the student should not wait for it here.
    await enqueueIndexing(material.id).catch((error) => {
      console.error("Failed to queue indexing", error);
    });

    redirect(`/professor/materials?uploaded=${material.id}`);
  } catch (error) {
    if (error instanceof Error && error.message.includes("NEXT_REDIRECT")) {
      throw error;
    }

    // Do not leave an orphaned file behind if the database write failed.
    await deleteOriginal(storedName).catch(() => {});
    if (previewPath) await deletePreview(previewPath).catch(() => {});
    console.error("Failed to record upload", error);
    return { error: "The upload could not be saved. Please try again." };
  }
}

const updateSchema = z.object({
  materialId: z.string().min(1),
  title: z.string().trim().min(3, "Give the material a title").max(160),
  description: z.string().trim().max(2000).optional(),
  subjectId: z.string().min(1, "Choose a subject"),
});

/** Professors may edit their own material; admins may edit any of it. */
export async function updateMaterial(
  _prev: UploadState,
  formData: FormData,
): Promise<UploadState> {
  const user = await requireRole("PROFESSOR", "ADMIN");

  const parsed = updateSchema.safeParse({
    materialId: formData.get("materialId"),
    title: formData.get("title"),
    description: formData.get("description") || undefined,
    subjectId: formData.get("subjectId"),
  });
  if (!parsed.success) {
    return {
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string>,
    };
  }

  const material = await getMaterialForManage(parsed.data.materialId);
  if (!material) return { error: "That material no longer exists." };
  if (user.role !== "ADMIN" && material.professorId !== user.id) {
    return { error: "You can only edit material that you uploaded." };
  }

  const subject = await findSubjectById(parsed.data.subjectId);
  if (!subject) {
    return { fieldErrors: { subjectId: "That subject no longer exists" } };
  }

  await updateMaterialFields(material.id, {
    title: parsed.data.title,
    description: parsed.data.description || null,
    subjectId: subject.id,
  });

  revalidatePath("/materials");
  revalidatePath(`/materials/${material.id}`);
  revalidatePath("/professor/materials");
  redirect(`/professor/materials?updated=${material.id}`);
}

export async function deleteMaterial(materialId: string): Promise<void> {
  const user = await requireRole("PROFESSOR", "ADMIN");

  const material = await getMaterialForManage(materialId);
  if (!material) return;
  if (user.role !== "ADMIN" && material.professorId !== user.id) {
    throw new Error("You can only delete material that you uploaded.");
  }

  await deleteMaterialById(material.id);
  await deleteOriginal(material.storedName).catch(() => {});
  if (material.previewPath) {
    await deletePreview(material.previewPath).catch(() => {});
  }

  revalidatePath("/materials");
  revalidatePath("/professor/materials");
  redirect("/professor/materials?deleted=1");
}