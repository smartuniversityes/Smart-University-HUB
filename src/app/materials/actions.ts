"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { toggleFavorite } from "@/models/favorite";

const idSchema = z.string().min(1, "Missing material id");

/** Adds or removes the signed-in user's favourite, returning the new state. */
export async function toggleFavourite(materialId: string): Promise<boolean> {
  const user = await requireUser();
  const id = idSchema.parse(materialId);

  const favourite = await toggleFavorite(user.id, id);

  revalidatePath("/materials");
  revalidatePath("/favorites");
  revalidatePath(`/materials/${id}`);

  return favourite;
}