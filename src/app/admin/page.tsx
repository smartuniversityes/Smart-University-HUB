import type { Metadata } from "next";
import Link from "next/link";
import {
  AlertTriangle,
  FileText,
  FolderTree,
  Heart,
  Loader2,
  TrendingUp,
  Users,
} from "lucide-react";
import { requireRole } from "@/lib/auth";
import { getDashboardStats } from "@/models/dashboard";
import { ROLE_LABELS } from "@/lib/constants";
import { formatBytes } from "@/lib/format";
import { getFileKind } from "@/lib/file-types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

export const metadata: Metadata = { title: "Admin" };
export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  await requireRole("ADMIN");

  const {
    userCount,
    professorCount,
    studentCount,
    materialCount,
    subjectCount,
    downloadCount,
    totalBytes,
    failedPreviews,
    runningJobs,
    topMaterials,
    topProfessors,
    depth,
  } = await getDashboardStats();

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-semibold tracking-tight">Admin dashboard</h1>
      <p className="mt-2 text-muted-foreground">
        System overview and quick access to user and subject management.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Registered users"
          value={userCount}
          hint={`${professorCount} professors · ${studentCount} students`}
          icon={Users}
        />
        <StatCard
          title="Published material"
          value={materialCount}
          hint={`across ${subjectCount} subjects`}
          icon={FileText}
        />
        <StatCard
          title="Downloads recorded"
          value={downloadCount}
          hint="all time"
          icon={TrendingUp}
        />
        <StatCard
          title="Stored size"
          value={formatBytes(totalBytes)}
          hint="sum of uploaded originals"
          icon={FolderTree}
        />
      </div>

      {failedPreviews > 0 || runningJobs > 0 || depth.queued > 0 ? (
        <div className="mt-6 flex flex-wrap items-center gap-3 rounded-xl border border-border/60 bg-muted/30 px-4 py-3 text-sm">
          {runningJobs > 0 || depth.queued > 0 ? (
            <>
              <Loader2 className="size-4 animate-spin text-primary" aria-hidden="true" />
              <span>
                {depth.running} converting, {depth.queued} queued.
              </span>
            </>
          ) : null}
          {failedPreviews > 0 ? (
            <span className="inline-flex items-center gap-2 text-destructive">
              <AlertTriangle className="size-4" aria-hidden="true" />
              {failedPreviews} preview{failedPreviews === 1 ? "" : "s"} failed to convert.
              Students can still download those originals.
            </span>
          ) : null}
        </div>
      ) : null}

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Most downloaded</CardTitle>
          </CardHeader>
          <CardContent>
            {topMaterials.length === 0 ? (
              <EmptyRow label="No material published yet." />
            ) : (
              <ol className="space-y-3">
                {topMaterials.map((material, index) => (
                  <li key={material.id} className="flex items-center gap-3 text-sm">
                    <span className="w-5 shrink-0 text-right text-muted-foreground tabular-nums">
                      {index + 1}
                    </span>
                    <Link
                      href={`/materials/${material.id}`}
                      className="min-w-0 flex-1 truncate hover:underline"
                    >
                      {material.title}
                    </Link>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {material.subject.code}
                    </span>
                    <Badge variant="secondary" className="shrink-0 tabular-nums">
                      {material.downloadCount}
                    </Badge>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Most active lecturers</CardTitle>
          </CardHeader>
          <CardContent>
            {topProfessors.length === 0 ? (
              <EmptyRow label="No professors have uploaded yet." />
            ) : (
              <ol className="space-y-3">
                {topProfessors.map((professor, index) => (
                  <li key={professor.id} className="flex items-center gap-3 text-sm">
                    <span className="w-5 shrink-0 text-right text-muted-foreground tabular-nums">
                      {index + 1}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{professor.name}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {ROLE_LABELS.PROFESSOR}
                    </span>
                    <Badge variant="secondary" className="shrink-0 tabular-nums">
                      {professor._count.materials}
                    </Badge>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Quick actions</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2">
            <Button asChild variant="outline" className="justify-start">
              <Link href="/admin/users">
                <Users className="size-4" aria-hidden="true" />
                Manage users and roles
              </Link>
            </Button>
            <Button asChild variant="outline" className="justify-start">
              <Link href="/admin/subjects">
                <FolderTree className="size-4" aria-hidden="true" />
                Manage subjects and semesters
              </Link>
            </Button>
            <Button asChild variant="outline" className="justify-start">
              <Link href="/materials">
                <FileText className="size-4" aria-hidden="true" />
                Review all material
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Storage</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Uploads stored locally</span>
                <span className="tabular-nums">{formatBytes(totalBytes)}</span>
              </div>
              <Progress
                value={Math.min(100, (totalBytes / (50 * 1024 * 1024 * 1024)) * 100)}
                className="mt-2"
              />
              <p className="mt-1.5 text-xs text-muted-foreground">
                Scale shown against 50 GB. Files live in the uploads directory on
                this server, so move to shared storage before running multiple
                instances.
              </p>
            </div>
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <Heart className="size-3.5" aria-hidden="true" />
              Favourites and downloads are recorded for analytics only.
            </p>
          </CardContent>
        </Card>
      </div>

      <p className="mt-8 text-xs text-muted-foreground">
        Preview formats supported:{" "}
        {["pdf", "pptx", "docx", "xlsx", "txt", "md", "csv", "log"]
          .map((extension) => getFileKind(extension)?.short ?? extension.toUpperCase())
          .join(", ")}
      </p>
    </div>
  );
}

function StatCard({
  title,
  value,
  hint,
  icon: Icon,
}: {
  title: string;
  value: number | string;
  hint: string;
  icon: typeof Users;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-normal text-muted-foreground">
            {title}
          </CardTitle>
          <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold tabular-nums">{value}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}

function EmptyRow({ label }: { label: string }) {
  return <p className="py-6 text-center text-sm text-muted-foreground">{label}</p>;
}
