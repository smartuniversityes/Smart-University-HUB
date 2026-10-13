import Link from "next/link";
import { Download, FileText, User } from "lucide-react";
import type { Material, Subject, User as UserModel } from "@/generated/prisma/client";
import { getFileKind } from "@/lib/file-types";
import { isSampleRecord } from "@/lib/materials";
import { formatBytes, formatDate, initials } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export type MaterialCardData = Pick<
  Material,
  | "id"
  | "title"
  | "description"
  | "extension"
  | "sizeBytes"
  | "downloadCount"
  | "createdAt"
  | "storedName"
> & {
  subject: Pick<Subject, "id" | "code" | "name" | "semester">;
  professor: Pick<UserModel, "id" | "name">;
};

/**
 * The sample rows created by the seed script have no real file on disk yet, so
 * they are shown without a download action rather than linking to a 404.
 */
export function FileTypeBadge({ extension }: { extension: string }) {
  const kind = getFileKind(extension);
  if (!kind) return <Badge variant="secondary">{extension.toUpperCase()}</Badge>;
  return (
    <Badge variant="secondary" className={`font-medium ${kind.accent}`}>
      {kind.short}
    </Badge>
  );
}

export function MaterialCard({ material }: { material: MaterialCardData }) {
  const sample = isSampleRecord(material);
  const hasDescription = Boolean(material.description);

  return (
    <Card className="group relative h-full overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-muted text-muted-foreground transition-colors group-hover:bg-primary/10 group-hover:text-primary">
            <FileText className="size-5" aria-hidden="true" />
          </span>
          <FileTypeBadge extension={material.extension} />
        </div>
        <CardTitle className="mt-3 text-base leading-snug">
          <Link
            href={`/materials/${material.id}`}
            className="outline-none after:absolute after:inset-0 after:content-[''] focus-visible:underline"
          >
            {material.title}
          </Link>
        </CardTitle>
        {hasDescription ? (
          <CardDescription className="line-clamp-2 text-sm">
            {material.description}
          </CardDescription>
        ) : null}
      </CardHeader>

      <CardContent className="pb-2 text-xs text-muted-foreground">
        <p className="font-medium text-foreground/80">
          {material.subject.code} — {material.subject.name}
        </p>
        <p className="mt-0.5">Semester {material.subject.semester}</p>
        <p className="mt-2 flex items-center gap-1.5">
          <User className="size-3" aria-hidden="true" />
          <span className="truncate">{material.professor.name}</span>
        </p>
      </CardContent>

      <CardFooter className="justify-between border-t border-border/60 px-6 py-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-3">
          <span>{formatDate(material.createdAt)}</span>
          {!sample ? <span>{formatBytes(material.sizeBytes)}</span> : null}
        </span>
        <span className="flex items-center gap-1.5">
          <Download className="size-3" aria-hidden="true" />
          {material.downloadCount}
        </span>
      </CardFooter>
    </Card>
  );
}

export function AvatarInitials({ name }: { name: string }) {
  return (
    <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
      {initials(name)}
    </span>
  );
}
