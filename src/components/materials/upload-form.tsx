"use client";

import { startTransition, useCallback, useRef, useState } from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { FileUp, Loader2, UploadCloud, X } from "lucide-react";
import { toast } from "sonner";
import { uploadMaterial, type UploadState } from "@/app/professor/actions";
import {
  ACCEPT_ATTRIBUTE,
  MAX_UPLOAD_BYTES,
  getExtension,
  getFileKind,
  isAllowedExtension,
} from "@/lib/file-types";
import { formatBytes } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const INITIAL: UploadState = {};

type SubjectOption = { id: string; code: string; name: string; semester: number };

export function UploadForm({ subjects }: { subjects: SubjectOption[] }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [state, formAction, pending] = useActionState(uploadMaterial, INITIAL);
  const [file, setFile] = useState<File | null>(null);
  const [subjectId, setSubjectId] = useState("");
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);

  const onFile = useCallback((candidate: File | null) => {
    if (!candidate) return;

    if (candidate.size > MAX_UPLOAD_BYTES) {
      toast.error(
        `"${candidate.name}" is ${formatBytes(candidate.size)}. The limit is ${formatBytes(MAX_UPLOAD_BYTES)}.`,
      );
      return;
    }

    const extension = getExtension(candidate.name);
    if (!isAllowedExtension(extension)) {
      toast.error(`.${extension || "?"} files are not supported.`);
      return;
    }

    setFile(candidate);
    setProgress(null);

    // Prefill the title from the file name while the field is still empty.
    const form = inputRef.current?.form;
    const title = form?.elements.namedItem("title") as HTMLInputElement | null;
    if (title && !title.value) {
      title.value = candidate.name
        .replace(/\.[^.]+$/, "")
        .replace(/[_-]+/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .replace(/^./, (char) => char.toUpperCase());
    }
  }, []);

  function handleDrop(event: React.DragEvent) {
    event.preventDefault();
    setDragging(false);
    onFile(event.dataTransfer.files?.[0] ?? null);
  }

  /**
   * The action is dispatched by hand rather than through the form's `action`
   * attribute so the chosen File can be attached and a progress bar shown.
   */
  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) {
      toast.error("Choose a file first.");
      return;
    }
    if (!subjectId) {
      toast.error("Choose a subject before uploading.");
      return;
    }

    const data = new FormData(event.currentTarget);
    data.set("file", file);
    data.set("subjectId", subjectId);

    setProgress(0);
    const timer = window.setInterval(
      () => setProgress((value) => Math.min(90, (value ?? 0) + 8)),
      200,
    );

    try {
      startTransition(() => {
        formAction(data);
      });
      window.clearInterval(timer);
      setProgress(100);
    } catch (error) {
      window.clearInterval(timer);
      setProgress(null);
      // A successful action ends in redirect(), which throws internally.
      if (error instanceof Error && error.message.includes("NEXT_REDIRECT")) return;
      toast.error("Upload failed. Please try again.");
      router.refresh();
    }
  }

  const kind = file ? getFileKind(getExtension(file.name)) : undefined;

  return (
    <form onSubmit={handleSubmit} className="space-y-6" noValidate>
      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={cn(
          "relative rounded-2xl border-2 border-dashed p-8 text-center transition-colors",
          dragging
            ? "border-primary bg-primary/5"
            : "border-border hover:border-primary/40 hover:bg-muted/30",
        )}
      >
        <input
          ref={inputRef}
          type="file"
          name="file"
          accept={ACCEPT_ATTRIBUTE}
          className="sr-only"
          onChange={(event) => onFile(event.target.files?.[0] ?? null)}
        />

        {file ? (
          <div className="flex flex-col items-center gap-3">
            <span className="grid size-12 place-items-center rounded-xl bg-primary/10 text-primary">
              <FileUp className="size-6" aria-hidden="true" />
            </span>
            <div>
              <p className="font-medium">{file.name}</p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {formatBytes(file.size)} · {kind?.label}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => inputRef.current?.click()}
              >
                Replace file
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setFile(null);
                  setProgress(null);
                  if (inputRef.current) inputRef.current.value = "";
                }}
              >
                <X className="size-4" aria-hidden="true" />
                Remove
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <span className="grid size-12 place-items-center rounded-xl bg-muted text-muted-foreground">
              <UploadCloud className="size-6" aria-hidden="true" />
            </span>
            <div>
              <p className="font-medium">Drop your file here</p>
              <p className="mt-1 text-sm text-muted-foreground">
                or click to browse · up to {formatBytes(MAX_UPLOAD_BYTES)}
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => inputRef.current?.click()}
            >
              Choose file
            </Button>
          </div>
        )}
      </div>

      {state.fieldErrors?.file ? (
        <p className="text-sm text-destructive">{state.fieldErrors.file}</p>
      ) : null}
      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="title">Title</Label>
          <Input
            id="title"
            name="title"
            placeholder="Lecture 05 - Linked Lists"
            required
          />
          {state.fieldErrors?.title ? (
            <p className="text-xs text-destructive">{state.fieldErrors.title}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="subjectId">Subject</Label>
          <input type="hidden" name="subjectId" value={subjectId} />
          <Select value={subjectId} onValueChange={setSubjectId} required>
            <SelectTrigger id="subjectId" className="w-full">
              <SelectValue placeholder="Choose a subject" />
            </SelectTrigger>
            <SelectContent>
              {subjects.map((subject) => (
                <SelectItem key={subject.id} value={subject.id}>
                  Sem {subject.semester} · {subject.code} — {subject.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {state.fieldErrors?.subjectId ? (
            <p className="text-xs text-destructive">{state.fieldErrors.subjectId}</p>
          ) : null}
        </div>

        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="description">
            Description{" "}
            <span className="font-normal text-muted-foreground">(optional)</span>
          </Label>
          <Textarea
            id="description"
            name="description"
            rows={3}
            placeholder="What does this material cover?"
          />
        </div>
      </div>

      {progress !== null ? (
        <div className="space-y-1.5">
          <Progress value={progress} />
          <p className="text-xs text-muted-foreground">
            {progress < 100 ? "Uploading..." : "Uploaded. Opening your uploads..."}
          </p>
        </div>
      ) : null}

      <Button type="submit" disabled={pending || !file} className="w-full sm:w-auto">
        {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
        {pending ? "Uploading..." : "Upload material"}
      </Button>
    </form>
  );
}
