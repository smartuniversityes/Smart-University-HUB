import type { Metadata } from "next";
import Link from "next/link";
import { FileText, Upload } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { listProfMaterial } from "@/models/material";
import { Button } from "@/components/ui/button";
import { DeleteMaterialButton } from "@/components/materials/delete-material-button";
import { FileTypeBadge } from "@/components/materials/material-card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const metadata: Metadata = { title: "My uploads" };
export const dynamic = "force-dynamic";

export default async function MyMaterialsPage() {
  const user = await requireRole("PROFESSOR", "ADMIN");

  const materials = await listProfMaterial(user.id, user.role === "ADMIN");
  const totalDownloads = materials.reduce((sum, item) => sum + item.downloadCount, 0);

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            {user.role === "ADMIN" ? "All material" : "My uploads"}
          </h1>
          <p className="mt-2 text-muted-foreground">
            {materials.length} material{materials.length === 1 ? "" : "s"} ·{" "}
            {totalDownloads} total download{totalDownloads === 1 ? "" : "s"}
          </p>
        </div>
        <Button asChild>
          <Link href="/professor/upload">
            <Upload className="size-4" aria-hidden="true" />
            Upload material
          </Link>
        </Button>
      </div>

      {materials.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-dashed border-border py-16 text-center">
          <FileText className="mx-auto size-8 text-muted-foreground" aria-hidden="true" />
          <p className="mt-3 font-medium">Nothing uploaded yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Upload your first lecture and it will appear here.
          </p>
          <Button asChild size="sm" className="mt-5">
            <Link href="/professor/upload">Upload material</Link>
          </Button>
        </div>
      ) : (
        <div className="mt-8 overflow-hidden rounded-xl border border-border/60">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead className="hidden sm:table-cell">Subject</TableHead>
                <TableHead className="hidden md:table-cell">Downloads</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {materials.map((material) => (
                <TableRow key={material.id}>
                  <TableCell className="max-w-xs sm:max-w-md">
                    <Link
                      href={`/materials/${material.id}`}
                      className="block truncate font-medium hover:text-primary hover:underline"
                    >
                      {material.title}
                    </Link>
                    <div className="mt-1 flex items-center gap-2">
                      <FileTypeBadge extension={material.extension} />
                      {material.previewStatus === "PENDING" ||
                      material.previewStatus === "RUNNING" ? (
                        <Badge variant="secondary" className="text-[10px]">
                          converting
                        </Badge>
                      ) : null}
                      {material.previewStatus === "FAILED" ? (
                        <Badge
                          variant="secondary"
                          className="bg-destructive/10 text-[10px] text-destructive"
                        >
                          preview failed
                        </Badge>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <span className="text-sm">{material.subject.code}</span>
                    <span className="block text-xs text-muted-foreground">
                      Semester {material.subject.semester}
                    </span>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-sm">
                    {material.downloadCount}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button asChild variant="ghost" size="sm">
                        <Link href={`/professor/materials/${material.id}/edit`}>
                          Edit
                        </Link>
                      </Button>
                      <DeleteMaterialButton materialId={material.id} />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
