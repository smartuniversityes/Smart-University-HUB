import type { Metadata } from "next";
import Link from "next/link";
import { Heart } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { listFavoriteMaterials } from "@/models/favorite";
import { MaterialCard } from "@/components/materials/material-card";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "My favourites" };
export const dynamic = "force-dynamic";

export default async function FavoritesPage() {
  const user = await requireUser();

  const materials = await listFavoriteMaterials(user.id);

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="flex items-center gap-2 text-3xl font-semibold tracking-tight">
        <Heart className="size-6 text-primary" aria-hidden="true" />
        My favourites
      </h1>
      <p className="mt-2 text-muted-foreground">
        {materials.length} saved material{materials.length === 1 ? "" : "s"}
      </p>

      {materials.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-dashed border-border py-16 text-center">
          <Heart className="mx-auto size-8 text-muted-foreground" aria-hidden="true" />
          <p className="mt-3 font-medium">Nothing saved yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Tap the heart on any material to keep it here for the semester.
          </p>
          <Button asChild size="sm" className="mt-5">
            <Link href="/materials">Browse material</Link>
          </Button>
        </div>
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {materials.map((material) => (
            <MaterialCard key={material.id} material={material} />
          ))}
        </div>
      )}
    </div>
  );
}
