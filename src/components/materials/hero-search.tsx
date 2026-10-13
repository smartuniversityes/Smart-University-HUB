"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function HeroSearch() {
  const router = useRouter();
  const [value, setValue] = useState("");

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const query = value.trim();
    router.push(query ? `/materials?q=${encodeURIComponent(query)}` : "/materials");
  }

  return (
    <form onSubmit={submit} className="mx-auto max-w-2xl" role="search">
      <div className="group relative flex items-center rounded-2xl border border-border bg-background p-1.5 shadow-sm transition-shadow focus-within:shadow-md">
        <Search
          className="pointer-events-none absolute left-4 size-5 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          value={value}
          onChange={(event) => setValue(event.target.value)}
          type="search"
          name="q"
          placeholder="Search lectures, notes and references"
          aria-label="Search study material"
          className="h-12 border-0 bg-transparent pl-12 pr-10 text-base shadow-none focus-visible:ring-0"
        />
        {value ? (
          <button
            type="button"
            onClick={() => setValue("")}
            aria-label="Clear search"
            className="absolute right-12 grid size-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        ) : null}
        <Button type="submit" className="h-11 rounded-xl px-5">
          Search
        </Button>
      </div>
    </form>
  );
}
