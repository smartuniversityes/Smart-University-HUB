"use client";

import { useCallback, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Loader2, Search, SlidersHorizontal, X } from "lucide-react";
import { ALLOWED_EXTENSIONS, FILE_KINDS } from "@/lib/file-types";
import { SEMESTERS } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Options = {
  subjects: { id: string; code: string; name: string; semester: number }[];
  professors: { id: string; name: string }[];
  showFavourites: boolean;
  canFilterFavourites: boolean;
};

type Props = { options: Options };

const ALL = "__all__";

/**
 * Filters live in the URL so a filtered view can be bookmarked or shared, and
 * so the server component can render the correct page on first paint.
 */
export function MaterialFilters({ options }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState("");

  // The URL is the source of truth, so the box is uncontrolled and remounted
  // whenever the committed query changes, such as after Back.
  const committedQuery = searchParams.get("q") ?? "";

  const active = {
    semester: searchParams.get("semester") ?? "",
    subject: searchParams.get("subject") ?? "",
    professor: searchParams.get("professor") ?? "",
    type: searchParams.get("type") ?? "",
    sort: searchParams.get("sort") ?? "recent",
  };

  const hasFilters =
    Boolean(searchParams.get("q")) ||
    Boolean(searchParams.get("semester")) ||
    Boolean(searchParams.get("subject")) ||
    Boolean(searchParams.get("professor")) ||
    Boolean(searchParams.get("type")) ||
    options.showFavourites;

  const push = useCallback(
    (mutate: (next: URLSearchParams) => void) => {
      const next = new URLSearchParams(searchParams.toString());
      mutate(next);
      next.delete("page");
      startTransition(() => {
        router.push(`${pathname}${next.size > 0 ? `?${next.toString()}` : ""}`, {
          scroll: false,
        });
      });
    },
    [pathname, router, searchParams],
  );

  function submitSearch(event: React.FormEvent) {
    event.preventDefault();
    const value = query.trim();
    push((next) => {
      if (value) next.set("q", value);
      else next.delete("q");
    });
  }

  function setParam(key: string, value: string) {
    push((next) => {
      if (value && value !== ALL) next.set(key, value);
      else next.delete(key);
    });
  }

  return (
    <div className="space-y-4">
      <form onSubmit={submitSearch} className="flex gap-2" role="search">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            key={committedQuery}
            defaultValue={committedQuery}
            onChange={(event) => setQuery(event.target.value)}
            type="search"
            placeholder="Search by title, subject or lecturer"
            aria-label="Search materials"
            className="h-11 pl-10"
          />
        </div>
        <Button type="submit" size="lg" className="h-11 px-5">
          Search
        </Button>
      </form>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1.5">
          <Label htmlFor="filter-semester" className="text-xs text-muted-foreground">
            Semester
          </Label>
          <Select
            value={active.semester || ALL}
            onValueChange={(value) => setParam("semester", value)}
          >
            <SelectTrigger id="filter-semester" className="w-full">
              <SelectValue placeholder="Any semester" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Any semester</SelectItem>
              {SEMESTERS.map((semester) => (
                <SelectItem key={semester} value={String(semester)}>
                  Semester {semester}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="filter-subject" className="text-xs text-muted-foreground">
            Subject
          </Label>
          <Select
            value={active.subject || ALL}
            onValueChange={(value) => setParam("subject", value)}
          >
            <SelectTrigger id="filter-subject" className="w-full">
              <SelectValue placeholder="Any subject" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Any subject</SelectItem>
              {options.subjects.map((subject) => (
                <SelectItem key={subject.id} value={subject.id}>
                  {subject.code} — {subject.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="filter-professor" className="text-xs text-muted-foreground">
            Lecturer
          </Label>
          <Select
            value={active.professor || ALL}
            onValueChange={(value) => setParam("professor", value)}
          >
            <SelectTrigger id="filter-professor" className="w-full">
              <SelectValue placeholder="Any lecturer" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Any lecturer</SelectItem>
              {options.professors.map((professor) => (
                <SelectItem key={professor.id} value={professor.id}>
                  {professor.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="filter-type" className="text-xs text-muted-foreground">
            File type
          </Label>
          <Select
            value={active.type || ALL}
            onValueChange={(value) => setParam("type", value)}
          >
            <SelectTrigger id="filter-type" className="w-full">
              <SelectValue placeholder="Any format" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Any format</SelectItem>
              {ALLOWED_EXTENSIONS.map((extension) => (
                <SelectItem key={extension} value={extension}>
                  {FILE_KINDS[extension].short}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Label htmlFor="filter-sort" className="whitespace-nowrap text-xs text-muted-foreground">
              Sort
            </Label>
            <Select value={active.sort} onValueChange={(value) => setParam("sort", value)}>
              <SelectTrigger id="filter-sort" size="sm" className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recent">Most recent</SelectItem>
                <SelectItem value="popular">Most downloaded</SelectItem>
                <SelectItem value="title">Title A–Z</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {options.canFilterFavourites ? (
            <div className="flex items-center gap-2">
              <Switch
                id="filter-favourites"
                checked={options.showFavourites}
                onCheckedChange={(checked) =>
                  push((next) => {
                    if (checked) next.set("favourites", "1");
                    else next.delete("favourites");
                  })
                }
              />
              <Label htmlFor="filter-favourites" className="text-xs text-muted-foreground">
                Favourites only
              </Label>
            </div>
          ) : null}

          {pending ? (
            <Loader2 className="size-4 animate-spin text-muted-foreground" aria-hidden="true" />
          ) : null}
        </div>

        {hasFilters ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              startTransition(() => {
                router.push(pathname, { scroll: false });
              })
            }
          >
            <X className="size-4" aria-hidden="true" />
            Clear filters
          </Button>
        ) : null}
      </div>

      {!options.subjects.length ? (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <SlidersHorizontal className="size-3" aria-hidden="true" />
          No subjects have been created yet.
        </p>
      ) : null}
    </div>
  );
}
