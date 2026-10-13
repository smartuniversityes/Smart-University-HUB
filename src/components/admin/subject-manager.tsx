"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { createSubject, deleteSubject, type AdminState } from "@/app/admin/actions";
import { SEMESTERS } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const INITIAL: AdminState = {};

type Row = {
  id: string;
  code: string;
  name: string;
  semester: number;
  section: string | null;
  department: string | null;
  _count: { materials: number };
};

export function SubjectManager({ subjects }: { subjects: Row[] }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(createSubject, INITIAL);
  const [showForm, setShowForm] = useState(false);

  const bySemester = subjects.reduce<Record<number, Row[]>>((groups, subject) => {
    (groups[subject.semester] ??= []).push(subject);
    return groups;
  }, {});

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {subjects.length} subject{subjects.length === 1 ? "" : "s"} configured
        </p>
        <Button
          type="button"
          variant={showForm ? "secondary" : "default"}
          onClick={() => setShowForm((value) => !value)}
        >
          <Plus className="size-4" aria-hidden="true" />
          {showForm ? "Cancel" : "Add subject"}
        </Button>
      </div>

      {showForm ? (
        <form
          action={action}
          className="grid gap-4 rounded-xl border border-border/60 bg-muted/20 p-5 sm:grid-cols-2 lg:grid-cols-3"
        >
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground" htmlFor="code">
              Code
            </Label>
            <Input id="code" name="code" placeholder="CS-201" required />
            {state.fieldErrors?.code ? (
              <p className="text-xs text-destructive">{state.fieldErrors.code}</p>
            ) : null}
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground" htmlFor="name">
              Name
            </Label>
            <Input id="name" name="name" placeholder="Data Structures" required />
            {state.fieldErrors?.name ? (
              <p className="text-xs text-destructive">{state.fieldErrors.name}</p>
            ) : null}
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground" htmlFor="semester">
              Semester
            </Label>
            <Select name="semester" defaultValue="1">
              <SelectTrigger id="semester" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SEMESTERS.map((semester) => (
                  <SelectItem key={semester} value={String(semester)}>
                    Semester {semester}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground" htmlFor="section">
              Section
            </Label>
            <Input id="section" name="section" placeholder="A" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground" htmlFor="department">
              Department
            </Label>
            <Input id="department" name="department" placeholder="Computer Science" />
          </div>
          <div className="flex items-end">
            <Button type="submit" disabled={pending} className="w-full">
              {pending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : null}
              {pending ? "Adding..." : "Add subject"}
            </Button>
          </div>
          {state.error ? (
            <p className="text-sm text-destructive sm:col-span-2 lg:col-span-3">
              {state.error}
            </p>
          ) : null}
          {state.success ? (
            <p className="text-sm text-primary sm:col-span-2 lg:col-span-3">
              {state.success}
            </p>
          ) : null}
        </form>
      ) : null}

      {subjects.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
          No subjects yet. Add one before material can be uploaded.
        </p>
      ) : (
        <div className="space-y-6">
          {SEMESTERS.filter((semester) => bySemester[semester]?.length).map(
            (semester) => (
              <section key={semester}>
                <h2 className="text-sm font-medium text-muted-foreground">
                  Semester {semester}
                </h2>
                <div className="mt-2 overflow-x-auto rounded-xl border border-border/60">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Code</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead className="hidden sm:table-cell">Section</TableHead>
                        <TableHead className="hidden md:table-cell">Department</TableHead>
                        <TableHead className="text-right">Material</TableHead>
                        <TableHead className="w-12" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {bySemester[semester].map((subject) => (
                        <SubjectRow
                          key={subject.id}
                          subject={subject}
                          onMutate={() => router.refresh()}
                        />
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </section>
            ),
          )}
        </div>
      )}
    </div>
  );
}

function SubjectRow({ subject, onMutate }: { subject: Row; onMutate: () => void }) {
  const [pending, startTransition] = useTransition();
  const blocked = subject._count.materials > 0;

  function remove() {
    startTransition(async () => {
      try {
        await deleteSubject(subject.id);
        toast.success(`${subject.code} was removed.`);
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "That subject could not be removed.",
        );
      } finally {
        onMutate();
      }
    });
  }

  return (
    <TableRow>
      <TableCell className="font-mono text-sm">{subject.code}</TableCell>
      <TableCell>{subject.name}</TableCell>
      <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
        {subject.section || "—"}
      </TableCell>
      <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
        {subject.department || "—"}
      </TableCell>
      <TableCell className="text-right text-sm tabular-nums">
        {subject._count.materials}
      </TableCell>
      <TableCell className="text-right">
        <Button
          size="icon"
          variant="ghost"
          disabled={pending || blocked}
          title={
            blocked
              ? "Remove the attached material before deleting this subject"
              : `Delete ${subject.code}`
          }
          onClick={remove}
        >
          {pending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <Trash2 className="size-4" aria-hidden="true" />
          )}
          <span className="sr-only">Delete {subject.code}</span>
        </Button>
      </TableCell>
    </TableRow>
  );
}
