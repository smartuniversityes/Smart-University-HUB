import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { RegisterForm } from "@/components/auth/register-form";

export const metadata: Metadata = { title: "Create account" };

export default function RegisterPage() {
  return (
    <div className="mx-auto w-full max-w-xl px-4 py-10 sm:px-6 lg:py-16">
      <Link
        href="/"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Back to home
      </Link>

      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
        Create your account
      </h1>
      <p className="mt-2 text-muted-foreground">
        Students can download material. Professors can upload it.
      </p>

      <div className="mt-8">
        <RegisterForm />
      </div>
    </div>
  );
}
