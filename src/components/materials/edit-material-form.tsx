"use client";

import { useActionState } from "react";
import { Loader2, Save } from "lucide-react";
import { updateMaterial, type UploadState } from "@/app/professor/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const INITIAL: UploadState = {};

type Props = {
  material: { id: string; title: string; description: string | null; subjectId: string };
  subjects: { id: string; code: string; name: string; semester: number }[];
};

/** Every field is a plain input, so the form posts straight to the action. */
export function EditMaterialForm({ material, subjects }: Props) {
  const [state, action, pending] = useActionState(updateMaterial, INITIAL);

  return (
    <form action={action} className="space-y-6" noValidate>
      <input type="hidden" name="materialId" value={material.id} />

      <div className="space-y-2">
        <Label htmlFor="title">Title</Label>
        <Input id="title" name="title" defaultValue={material.title} required />
        {state.fieldErrors?.title ? (
          <p className="text-xs text-destructive">{state.fieldErrors.title}</p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="subjectId">Subject</Label>
        <Select name="subjectId" defaultValue={material.subjectId} required>
          <SelectTrigger id="subjectId" className="w-full">
            <SelectValue />
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

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          name="description"
          rows={4}
          defaultValue={material.description ?? ""}
        />
      </div>

      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}

      <Button type="submit" disabled={pending}>
        {pending ? (
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        ) : (
          <Save className="size-4" aria-hidden="true" />
        )}
        {pending ? "Saving..." : "Save changes"}
      </Button>
    </form>
  );
}
