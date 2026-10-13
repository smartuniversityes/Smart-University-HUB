"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { LayoutDashboard, LogOut, Settings, Heart, Upload } from "lucide-react";
import type { SessionUser } from "@/lib/auth";
import { ROLE_LABELS, type Role } from "@/lib/constants";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { logout } from "@/app/(auth)/actions";

function roleHome(role: Role): string {
  if (role === "ADMIN") return "/admin";
  if (role === "PROFESSOR") return "/professor/materials";
  return "/materials";
}

export function UserMenu({ user }: { user: SessionUser }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleLogout() {
    startTransition(async () => {
      await logout();
      router.push("/");
      router.refresh();
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="gap-2 px-2" aria-label="Account menu">
          <Avatar className="size-7">
            <AvatarFallback className="bg-primary/10 text-[11px] font-semibold text-primary">
              {user.name
                .split(" ")
                .slice(0, 2)
                .map((part) => part[0]?.toUpperCase())
                .join("")}
            </AvatarFallback>
          </Avatar>
          <span className="hidden max-w-32 truncate text-sm font-medium lg:inline">
            {user.name}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="font-normal">
          <p className="truncate text-sm font-medium">{user.name}</p>
          <p className="truncate text-xs text-muted-foreground">{user.email}</p>
          <span className="mt-1.5 inline-flex rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
            {ROLE_LABELS[user.role]}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href={roleHome(user.role)}>
            <LayoutDashboard className="size-4" aria-hidden="true" />
            Dashboard
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/favorites">
            <Heart className="size-4" aria-hidden="true" />
            Favourites
          </Link>
        </DropdownMenuItem>
        {user.role === "PROFESSOR" || user.role === "ADMIN" ? (
          <DropdownMenuItem asChild>
            <Link href="/professor/upload">
              <Upload className="size-4" aria-hidden="true" />
              Upload material
            </Link>
          </DropdownMenuItem>
        ) : null}
        {user.role === "ADMIN" ? (
          <DropdownMenuItem asChild>
            <Link href="/admin/users">
              <Settings className="size-4" aria-hidden="true" />
              Manage users
            </Link>
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={handleLogout} disabled={pending}>
          <LogOut className="size-4" aria-hidden="true" />
          {pending ? "Signing out..." : "Sign out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
