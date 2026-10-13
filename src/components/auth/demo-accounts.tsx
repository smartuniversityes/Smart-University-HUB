"use client";

import { useState } from "react";
import { ChevronDown, FlaskConical } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";

const DEMO = [
  { role: "Admin", email: "admin@university.edu" },
  { role: "Professor", email: "ayesha.khan@university.edu" },
  { role: "Professor", email: "bilal.ahmed@university.edu" },
  { role: "Student", email: "ali.raza@student.university.edu" },
];

/** Fills the login form so the demo can be driven quickly during a viva. */
export function DemoAccounts() {
  const [open, setOpen] = useState(false);

  function fill(email: string) {
    const form = document.querySelector("form");
    if (!form) return;
    const emailInput = form.querySelector<HTMLInputElement>("#email");
    const passwordInput = form.querySelector<HTMLInputElement>("#password");
    if (emailInput) {
      emailInput.value = email;
      emailInput.dispatchEvent(new Event("input", { bubbles: true }));
    }
    if (passwordInput) {
      passwordInput.value = "Password123";
      passwordInput.dispatchEvent(new Event("input", { bubbles: true }));
    }
  }

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className="rounded-xl border border-dashed border-border"
    >
      <CollapsibleTrigger asChild>
        <Button variant="ghost" size="sm" className="w-full justify-between px-3">
          <span className="flex items-center gap-2 text-muted-foreground">
            <FlaskConical className="size-4" aria-hidden="true" />
            Demo accounts
          </span>
          <ChevronDown
            className={`size-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
            aria-hidden="true"
          />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="px-3 pb-3">
        <ul className="space-y-1">
          {DEMO.map((account) => (
            <li key={account.email}>
              <button
                type="button"
                onClick={() => fill(account.email)}
                className="flex w-full items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-left text-xs transition-colors hover:bg-accent"
              >
                <span className="font-medium">{account.role}</span>
                <span className="truncate text-muted-foreground">{account.email}</span>
              </button>
            </li>
          ))}
        </ul>
        <p className="mt-2 px-2 text-[11px] text-muted-foreground">
          Password for every demo account: <code>Password123</code>
        </p>
      </CollapsibleContent>
    </Collapsible>
  );
}
