"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GraduationCap, Loader2, UserCog } from "lucide-react";
import { register, type FormState } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const INITIAL: FormState = {};

const OPTIONS = [
  {
    value: "STUDENT" as const,
    title: "Student",
    description: "Browse, preview and download study material",
    icon: GraduationCap,
  },
  {
    value: "PROFESSOR" as const,
    title: "Professor",
    description: "Upload and manage your own lecture material",
    icon: UserCog,
  },
];

export function RegisterForm() {
  const [state, action, pending] = useActionState(register, INITIAL);
  const [role, setRole] = useState<"STUDENT" | "PROFESSOR">("STUDENT");
  const router = useRouter();

  return (
    <form action={action} className="space-y-5" noValidate>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">I am a</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {OPTIONS.map((option) => {
            const active = role === option.value;
            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={active}
                data-role-option={option.value}
                onClick={() => setRole(option.value)}
                onKeyDown={(event) => {
                  if (
                    event.key === "ArrowLeft" ||
                    event.key === "ArrowRight" ||
                    event.key === "ArrowUp" ||
                    event.key === "ArrowDown"
                  ) {
                    event.preventDefault();
                    const index = OPTIONS.findIndex((o) => o.value === role);
                    const delta =
                      event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : -1;
                    const next =
                      OPTIONS[(index + delta + OPTIONS.length) % OPTIONS.length];
                    setRole(next.value);
                    document
                      .querySelector<HTMLElement>(
                        `[data-role-option="${next.value}"]`,
                      )
                      ?.focus();
                  }
                }}
                className={cn(
                  "flex cursor-pointer touch-manipulation flex-col gap-1 rounded-xl border p-3 text-left transition-colors",
                  active
                    ? "border-primary bg-primary/5"
                    : "border-border hover:bg-accent/50",
                )}
              >
                <span className="flex items-center gap-2 text-sm font-medium">
                  <option.icon className="size-4 text-primary" aria-hidden="true" />
                  {option.title}
                </span>
                <span className="text-xs text-muted-foreground">
                  {option.description}
                </span>
              </button>
            );
          })}
        </div>
        <input type="hidden" name="role" value={role} />
        {state.fieldErrors?.role ? (
          <p className="text-xs text-destructive">{state.fieldErrors.role}</p>
        ) : null}
      </fieldset>

      <div className="space-y-2">
        <Label htmlFor="name">Full name</Label>
        <Input id="name" name="name" autoComplete="name" placeholder="Ali Raza" required />
        {state.fieldErrors?.name ? (
          <p className="text-xs text-destructive">{state.fieldErrors.name}</p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">University email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@university.edu"
          required
        />
        {state.fieldErrors?.email ? (
          <p className="text-xs text-destructive">{state.fieldErrors.email}</p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="department">Department (optional)</Label>
        <Input
          id="department"
          name="department"
          placeholder="Computer Science"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
          />
          {state.fieldErrors?.password ? (
            <p className="text-xs text-destructive">{state.fieldErrors.password}</p>
          ) : (
            <p className="text-xs text-muted-foreground">At least 8 characters.</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Confirm password</Label>
          <Input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            required
          />
          {state.fieldErrors?.confirmPassword ? (
            <p className="text-xs text-destructive">
              {state.fieldErrors.confirmPassword}
            </p>
          ) : null}
        </div>
      </div>

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
        {pending ? "Creating account..." : "Create account"}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        Already registered?{" "}
        <button
          type="button"
          onClick={() => router.push("/login")}
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          Sign in
        </button>{" "}
        or{" "}
        <Link href="/login" className="sr-only">
          Sign in
        </Link>
      </p>
    </form>
  );
}
