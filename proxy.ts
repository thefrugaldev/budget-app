import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// Next 16 renamed the `middleware` file convention to `proxy` (AGENTS.md /
// ADR 0004). Clerk's `clerkMiddleware` runs here as the request proxy — one of
// the three sanctioned Clerk-SDK sites — establishing the auth context that the
// boundary's `auth()` reads, and performing an *optimistic* signed-out
// redirect. Genuine verification (session → membership → role) happens
// server-side in the boundary and loaders, never here.

// Public routes that must render without a session: the sign-in screen and
// Clerk's own SSO/callback sub-paths. Everything else is gated.
const isPublicRoute = createRouteMatcher(["/sign-in(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  if (isPublicRoute(req)) return;

  const { userId } = await auth();
  if (userId) return;

  // Signed out on a protected route — bounce to sign-in, preserving the
  // intended destination so the user returns where they were headed (story 15).
  const signInUrl = new URL("/sign-in", req.url);
  const destination = req.nextUrl.pathname + req.nextUrl.search;
  if (destination && destination !== "/") {
    signInUrl.searchParams.set("redirect_url", destination);
  }
  return NextResponse.redirect(signInUrl);
});

export const config = {
  // Run on every route except Next internals and static assets, so both page
  // loads and Server Function POSTs are gated. (Server Functions post to their
  // page's route, so this catch-all covers them — see the proxy docs' warning
  // against relying on a narrower matcher.)
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
