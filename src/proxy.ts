import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { isRole } from "@/lib/constants";

/**
 * Next 16 renamed the `middleware` convention to `proxy`. This runs on the
 * Node runtime before a route is rendered and gates the authenticated areas
 * with a cheap signature check only. It deliberately does not hit the database:
 * authoritative checks happen in the pages and route handlers themselves.
 */

/**
 * Browsing `/materials` stays public so the catalogue is easy to demo, while
 * the actions that actually move data (download, print, favourites, uploads)
 * are gated. Those are enforced in the route handlers, which re-check the
 * session against the database rather than trusting this signature alone.
 */
const PROTECTED_PREFIXES = ["/favorites", "/professor", "/admin", "/chat"] as const;

const AUTH_ROUTES = ["/login", "/register"] as const;

function getSecret(): Uint8Array | null {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 16) return null;
  return new TextEncoder().encode(secret);
}

async function hasValidSession(request: NextRequest): Promise<boolean> {
  const token = request.cookies.get("sue_session")?.value;
  if (!token) return false;
  const secret = getSecret();
  if (!secret) return false;

  try {
    const { payload } = await jwtVerify(token, secret);
    return typeof payload.sub === "string" && typeof payload.role === "string" && isRole(payload.role);
  } catch {
    return false;
  }
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const signedIn = await hasValidSession(request);

  const needsAuth = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
  const isAuthRoute = AUTH_ROUTES.some((route) => pathname.startsWith(route));

  if (needsAuth && !signedIn) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isAuthRoute && signedIn) {
    return NextResponse.redirect(new URL("/materials", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/favorites/:path*",
    "/professor/:path*",
    "/admin/:path*",
    "/chat/:path*",
    "/login",
    "/register",
  ],
};
