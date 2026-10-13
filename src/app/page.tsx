import Link from "next/link";
import {
  ArrowRight,
  FileText,
  Presentation,
  FileSpreadsheet,
  FileType2,
  Download,
  Eye,
  Search,
} from "lucide-react";
import { countMaterials, getRecentMaterials } from "@/models/material";
import { countSubjects } from "@/models/subject";
import { countActiveProfessors } from "@/models/user";
import { MaterialCard } from "@/components/materials/material-card";
import { HeroSearch } from "@/components/materials/hero-search";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const FEATURED_TYPES = [
  { icon: Presentation, label: "PowerPoint", ext: "pptx" },
  { icon: FileText, label: "PDF", ext: "pdf" },
  { icon: FileType2, label: "Word", ext: "docx" },
  { icon: FileSpreadsheet, label: "Excel", ext: "xlsx" },
];

export default async function HomePage() {
  const [materialCount, subjectCount, professorCount, recent] = await Promise.all([
    countMaterials(),
    countSubjects(),
    countActiveProfessors(),
    getRecentMaterials(6),
  ]);

  return (
    <>
      <section className="relative overflow-hidden border-b border-border/60">
        <div
          className="pointer-events-none absolute inset-x-0 -top-40 h-96 bg-[radial-gradient(60%_50%_at_50%_0%,var(--primary)_0%,transparent_70%)] opacity-[0.07]"
          aria-hidden="true"
        />
        <div className="relative mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <Badge
              variant="secondary"
              className="mb-6 gap-1.5 rounded-full px-3 py-1 text-xs font-medium"
            >
              <span className="size-1.5 rounded-full bg-primary" aria-hidden="true" />
              Centralised material for every course
            </Badge>

            <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">
              Every lecture your professor shared,
              <span className="text-primary"> in one place</span>
            </h1>

            <p className="mx-auto mt-5 max-w-2xl text-pretty text-base text-muted-foreground sm:text-lg">
              Upload slides once, and every student in that subject can find,
              preview and download them in seconds. No group chats, no guessing
              which file is the latest one.
            </p>

            <div className="mt-8">
              <HeroSearch />
            </div>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-x-8 gap-y-4 text-sm text-muted-foreground">
              {[
                { icon: FileText, value: materialCount, label: "materials shared" },
                { icon: Search, value: subjectCount, label: "subjects covered" },
                { icon: Download, value: professorCount, label: "professors" },
              ].map((stat) => (
                <span key={stat.label} className="flex items-center gap-2">
                  <stat.icon className="size-4 text-primary" aria-hidden="true" />
                  <span className="font-semibold text-foreground">{stat.value}</span>
                  {stat.label}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-border/60 bg-muted/20">
        <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <p className="mb-4 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Supports
          </p>
          <ul className="flex flex-wrap items-center justify-center gap-2">
            {FEATURED_TYPES.map((type) => (
              <li
                key={type.ext}
                className="flex items-center gap-2 rounded-full border border-border/60 bg-background px-3.5 py-1.5 text-sm"
              >
                <type.icon className="size-4 text-primary" aria-hidden="true" />
                {type.label}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Recently added</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              The newest material uploaded by your faculty.
            </p>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href="/materials">
              Browse all
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </Button>
        </div>

        {recent.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-dashed border-border py-16 text-center">
            <FileText className="mx-auto size-8 text-muted-foreground" aria-hidden="true" />
            <p className="mt-3 font-medium">No material uploaded yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Once a professor uploads a file it will appear here.
            </p>
            <Button asChild size="sm" className="mt-5">
              <Link href="/professor/upload">Upload the first file</Link>
            </Button>
          </div>
        ) : (
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {recent.map((material) => (
              <MaterialCard key={material.id} material={material} />
            ))}
          </div>
        )}
      </section>

      <section className="border-t border-border/60 bg-muted/20">
        <div className="mx-auto w-full max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="grid gap-8 sm:grid-cols-3">
            {[
              {
                icon: Search,
                title: "Search by anything",
                body: "Filter by semester, subject, lecturer or file type to reach the exact lecture you need.",
              },
              {
                icon: Eye,
                title: "Preview in the browser",
                body: "Slides, documents and spreadsheets are converted to PDF on the fly, so you can read before you download.",
              },
              {
                icon: Download,
                title: "One click to download",
                body: "Every file keeps its original name and format, so it opens exactly as your professor created it.",
              },
            ].map((feature) => (
              <div key={feature.title}>
                <span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
                  <feature.icon className="size-5" aria-hidden="true" />
                </span>
                <h3 className="mt-4 font-medium">{feature.title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{feature.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-border/60">
        <div className="mx-auto w-full max-w-3xl px-4 py-16 text-center sm:px-6 lg:px-8">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Teaching something this semester?
          </h2>
          <p className="mt-3 text-muted-foreground">
            Create a professor account and your students can start downloading
            your material immediately.
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Button asChild>
              <Link href="/register">Create a professor account</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/login">Sign in</Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
