"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Heart, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { toggleFavourite } from "@/app/materials/actions";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export function FavouriteButton({
  materialId,
  initialFavourite,
  variant = "default",
}: {
  materialId: string;
  initialFavourite: boolean;
  variant?: "default" | "icon";
}) {
  const router = useRouter();
  const [favourite, setFavourite] = useState(initialFavourite);
  const [pending, startTransition] = useTransition();

  function toggle() {
    // Optimistic flip, reverted if the action fails.
    const previous = favourite;
    setFavourite(!previous);
    startTransition(async () => {
      try {
        await toggleFavourite(materialId);
        router.refresh();
      } catch (error) {
        setFavourite(previous);
        if (error instanceof Error && error.message.includes("NEXT_REDIRECT")) return;
        toast.error("Could not update your favourites.");
      }
    });
  }

  const label = favourite ? "Remove from favourites" : "Add to favourites";

  if (variant === "icon") {
    return (
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={toggle}
        disabled={pending}
        aria-label={label}
        aria-pressed={favourite}
        className="absolute right-3 top-3 z-10 rounded-full bg-background/80 backdrop-blur"
      >
        {pending ? (
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        ) : (
          <Heart
            className={cn("size-4", favourite && "fill-primary text-primary")}
            aria-hidden="true"
          />
        )}
      </Button>
    );
  }

  return (
    <Button
      type="button"
      variant={favourite ? "secondary" : "outline"}
      onClick={toggle}
      disabled={pending}
      aria-pressed={favourite}
    >
      {pending ? (
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
      ) : (
        <Heart
          className={cn("size-4", favourite && "fill-primary text-primary")}
          aria-hidden="true"
        />
      )}
      {favourite ? "Saved" : "Save"}
    </Button>
  );
}
