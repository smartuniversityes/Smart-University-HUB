"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, Upload, LayoutDashboard, Users, FolderTree, Heart, Bot } from "lucide-react";
import type { SessionUser } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

type NavItem = { href: string; label: string; icon?: typeof Upload };

function navFor(user: SessionUser | null): NavItem[] {
  const items: NavItem[] = [{ href: "/materials", label: "Materials" }];
  if (!user) return items;

  items.push(
    { href: "/chat", label: "Ask AI", icon: Bot },
    { href: "/favorites", label: "Favourites", icon: Heart },
  );

  if (user.role === "PROFESSOR" || user.role === "ADMIN") {
    items.push({ href: "/professor/materials", label: "My uploads", icon: Upload });
  }
  if (user.role === "ADMIN") {
    items.push(
      { href: "/admin", label: "Admin", icon: LayoutDashboard },
      { href: "/admin/users", label: "Users", icon: Users },
      { href: "/admin/subjects", label: "Subjects", icon: FolderTree },
    );
  }
  return items;
}

export function HeaderNav({ user }: { user: SessionUser | null }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const items = navFor(user);

  const isActive = (href: string) =>
    pathname === href || (href !== "/" && pathname.startsWith(`${href}/`));

  return (
    <>
      <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              isActive(item.href)
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
            )}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="md:hidden">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Open navigation menu">
              <Menu className="size-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-72">
            <SheetHeader>
              <SheetTitle>Navigation</SheetTitle>
            </SheetHeader>
            <nav className="flex flex-col gap-1 px-4" aria-label="Mobile">
              {items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                    isActive(item.href)
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
                  )}
                >
                  {item.icon ? <item.icon className="size-4" aria-hidden="true" /> : null}
                  {item.label}
                </Link>
              ))}
              {user && (user.role === "PROFESSOR" || user.role === "ADMIN") ? (
                <Link
                  href="/professor/upload"
                  onClick={() => setOpen(false)}
                  className="mt-2 flex items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2.5 text-sm font-medium text-primary-foreground"
                >
                  <Upload className="size-4" aria-hidden="true" />
                  Upload material
                </Link>
              ) : null}
            </nav>
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}
