import type { Metadata } from "next";
import Link from "next/link";
import { FileSearch, Heart } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { parseFilters } from "@/lib/materials";
import { findMaterials, getFilterOptions } from "@/models/material";
import { MaterialCard } from "@/components/materials/material-card";
import { MaterialFilters } from "@/components/materials/material-filters";
import { Pagination } from "@/components/materials/pagination";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Study material" };
export const dynamic = "force-dynamic";

export default async function MaterialsPage({
  searchParams,
}: PageProps<"/materials">) {
  const params = await searchParams;
  const filters = parseFilters(params);
  const favouritesOnly = params.favourites === "1";

  const user = await getCurrentUser();
  const [result, options] = await Promise.all([
    findMaterials(filters, favouritesOnly ? user?.id : undefined),
    getFilterOptions(),
  ]);

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-semibold tracking-tight">
            {favouritesOnly ? (
              <>
                <Heart className="size-6 text-primary" aria-hidden="true" />
                My favourites
              </>
            ) : (
              "Study material"
            )}
          </h1>
          <p className="mt-2 text-muted-foreground">
            {result.total} material{result.total === 1 ? "" : "s"}
            {filters.query ? ` matching “${filters.query}”` : " available"}
          </p>
        </div>
        {!user ? (
          <Button asChild variant="outline" size="sm">
            <Link href="/login?next=/materials">Sign in to download</Link>
          </Button>
        ) : null}
      </div>

      <div className="mt-8">
        <MaterialFilters
          options={{
            subjects: options.subjects,
            professors: options.professors,
            showFavourites: favouritesOnly,
            canFilterFavourites: Boolean(user),
          }}
        />
      </div>

      {result.items.length === 0 ? (
        <div className="mt-12 rounded-2xl border border-dashed border-border py-16 text-center">
          <FileSearch className="mx-auto size-8 text-muted-foreground" aria-hidden="true" />
          <p className="mt-3 font-medium">
            {favouritesOnly ? "No favourites yet" : "No material found"}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {favouritesOnly
              ? "Tap the heart on any material to save it here."
              : "Try a different search term or clear your filters."}
          </p>
        </div>
      ) : (
        <>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {result.items.map((material) => (
              <MaterialCard key={material.id} material={material} />
            ))}
          </div>
          <Pagination page={result.page} pageCount={result.pageCount} />
        </>
      )}
    </div>
  );
}
