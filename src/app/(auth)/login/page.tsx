import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ShieldCheck, Zap, GraduationCap } from "lucide-react";
import { LoginForm } from "@/components/auth/login-form";
import { DemoAccounts } from "@/components/auth/demo-accounts";
import { Logo } from "@/components/logo";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: PageProps<"/login">) {
  const params = await searchParams;
  const nextPath = typeof params.next === "string" ? params.next : undefined;

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-10 sm:px-6 lg:grid-cols-2 lg:gap-16 lg:px-8 lg:py-16">
      <div className="flex flex-col justify-center order-2 lg:order-1">
        <Link
          href="/"
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back to home
        </Link>

        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Welcome back
        </h1>
        <p className="mt-2 text-muted-foreground">
          Sign in to download lecture material and manage your uploads.
        </p>

        <div className="mt-8 max-w-md">
          <LoginForm nextPath={nextPath} />
        </div>

        <div className="mt-8 max-w-md">
          <DemoAccounts />
        </div>
      </div>

      <aside className="order-1 hidden lg:order-2 lg:flex lg:flex-col lg:justify-center">
        <div className="space-y-8 rounded-2xl border border-border/60 bg-muted/30 p-8">
          <div>
            <Logo className="mb-4" />
            <p className="text-sm leading-relaxed text-muted-foreground">
              One place for every lecture, note and reference sheet your faculty
              has shared this semester.
            </p>
          </div>
          <ul className="space-y-4 text-sm">
            {[
              {
                icon: Zap,
                title: "Find anything in seconds",
                body: "Search by subject, semester or lecturer.",
              },
              {
                icon: GraduationCap,
                title: "Preview before downloading",
                body: "Slides, documents and sheets render right in the browser.",
              },
              {
                icon: ShieldCheck,
                title: "Organised by course",
                body: "Every file is tagged with its subject and semester.",
              },
            ].map((item) => (
              <li key={item.title} className="flex gap-3">
                <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                  <item.icon className="size-4" aria-hidden="true" />
                </span>
                <span>
                  <span className="block font-medium">{item.title}</span>
                  <span className="text-muted-foreground">{item.body}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  );
}
