"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import {
  changeUserRole,
  createUser,
  deleteUser,
  toggleUserActive,
  type AdminState,
} from "@/app/admin/actions";
import { ROLES, ROLE_LABELS } from "@/lib/constants";
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
import { formatDate } from "@/lib/format";

const INITIAL: AdminState = {};

type Row = {
  id: string;
  name: string;
  email: string;
  role: string;
  department: string | null;
  active: boolean;
  createdAt: Date;
  _count: { materials: number };
};

export function UserManager({ users, currentUserId }: { users: Row[]; currentUserId: string }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(createUser, INITIAL);
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState("");

  const visible = filter
    ? users.filter(
        (user) =>
          user.name.toLowerCase().includes(filter.toLowerCase()) ||
          user.email.toLowerCase().includes(filter.toLowerCase()),
      )
    : users;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Input
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          placeholder="Filter by name or email"
          aria-label="Filter users"
          className="max-w-xs"
        />
        <Button type="button" variant={showForm ? "secondary" : "default"} onClick={() => setShowForm((value) => !value)}>
          <Plus className="size-4" aria-hidden="true" />
          {showForm ? "Cancel" : "Add user"}
        </Button>
      </div>

      {showForm ? <CreateUserForm state={state} formAction={action} pending={pending} /> : null}

      <div className="overflow-x-auto rounded-xl border border-border/60">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead className="hidden md:table-cell">Role</TableHead>
              <TableHead className="hidden lg:table-cell">Material</TableHead>
              <TableHead className="hidden sm:table-cell">Joined</TableHead>
              <TableHead className="text-right">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.map((user) => (
              <UserRow
                key={user.id}
                user={user}
                isSelf={user.id === currentUserId}
                onMutate={() => router.refresh()}
              />
            ))}
          </TableBody>
        </Table>
      </div>

      {visible.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          No user matches that filter.
        </p>
      ) : null}
    </div>
  );
}

function CreateUserForm({
  state,
  formAction,
  pending,
}: {
  state: AdminState;
  formAction: (formData: FormData) => void;
  pending: boolean;
}) {
  return (
    <form action={formAction} className="grid gap-4 rounded-xl border border-border/60 bg-muted/20 p-5 sm:grid-cols-2 lg:grid-cols-3">
      <Field label="Full name" error={state.fieldErrors?.name}>
        <Input id="name" name="name" required />
      </Field>
      <Field label="Email" error={state.fieldErrors?.email}>
        <Input id="email" name="email" type="email" required />
      </Field>
      <Field label="Temporary password" error={state.fieldErrors?.password}>
        <Input id="password" name="password" type="password" required minLength={8} />
      </Field>
      <Field label="Role" error={state.fieldErrors?.role}>
        <Select name="role" defaultValue="STUDENT">
          <SelectTrigger id="role" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ROLES.map((role) => (
              <SelectItem key={role} value={role}>
                {ROLE_LABELS[role]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label="Department" error={state.fieldErrors?.department}>
        <Input id="department" name="department" />
      </Field>
      <div className="flex items-end">
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
          {pending ? "Creating..." : "Create user"}
        </Button>
      </div>
      {state.error ? (
        <p className="text-sm text-destructive sm:col-span-2 lg:col-span-3">{state.error}</p>
      ) : null}
      {state.success ? (
        <p className="text-sm text-primary sm:col-span-2 lg:col-span-3">{state.success}</p>
      ) : null}
    </form>
  );
}

function UserRow({
  user,
  isSelf,
  onMutate,
}: {
  user: Row;
  isSelf: boolean;
  onMutate: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);

  function run(action: () => Promise<void>, message: string) {
    startTransition(async () => {
      try {
        await action();
        toast.success(message);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "That did not work.");
      } finally {
        setConfirming(false);
        onMutate();
      }
    });
  }

  return (
    <TableRow className={user.active ? undefined : "opacity-60"}>
      <TableCell>
        <span className="block font-medium">{user.name}</span>
        <span className="block text-xs text-muted-foreground">{user.email}</span>
        {user.department ? (
          <span className="block text-xs text-muted-foreground">{user.department}</span>
        ) : null}
        {isSelf ? (
          <span className="mt-0.5 inline-block text-[10px] text-primary">You</span>
        ) : null}
      </TableCell>
      <TableCell className="hidden md:table-cell">
        {isSelf ? (
          <span className="text-sm">{ROLE_LABELS[user.role as never] ?? user.role}</span>
        ) : (
          <Select
            value={user.role}
            onValueChange={(role) => run(() => changeUserRole(user.id, role), "Role updated.")}
            disabled={pending}
          >
            <SelectTrigger size="sm" className="w-36" aria-label={`Role for ${user.name}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ROLES.map((role) => (
                <SelectItem key={role} value={role}>
                  {ROLE_LABELS[role]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </TableCell>
      <TableCell className="hidden lg:table-cell text-sm tabular-nums">
        {user._count.materials}
      </TableCell>
      <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
        {formatDate(user.createdAt)}
      </TableCell>
      <TableCell className="text-right">
        {isSelf ? (
          <span className="text-xs text-muted-foreground">Current session</span>
        ) : confirming ? (
          <div className="flex items-center justify-end gap-1">
            <Button
              size="sm"
              variant="destructive"
              disabled={pending}
              onClick={() => run(() => deleteUser(user.id), "User deleted.")}
            >
              Confirm
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-end gap-1">
            <span className="mr-1 text-xs text-muted-foreground">
              {user.active ? "Active" : "Deactivated"}
            </span>
            <Button
              size="sm"
              variant="ghost"
              disabled={pending}
              onClick={() =>
                run(
                  () => toggleUserActive(user.id),
                  user.active ? "Account deactivated." : "Account reactivated.",
                )
              }
            >
              {user.active ? "Deactivate" : "Reactivate"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-destructive hover:text-destructive"
              disabled={pending}
              onClick={() => setConfirming(true)}
            >
              Delete
            </Button>
          </div>
        )}
      </TableCell>
    </TableRow>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
