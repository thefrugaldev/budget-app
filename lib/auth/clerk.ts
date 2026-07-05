import "server-only";

import { auth, currentUser } from "@clerk/nextjs/server";

/**
 * The Clerk boundary adapter — the ONLY module that reads a session from the
 * Clerk SDK (ADR 0004's three-site seam: this, `proxy.ts`, and the sign-in
 * screen). Everything above it speaks our own shapes, so migrating off Clerk
 * later means rewriting this file and relinking users by verified email — the
 * domain data (households, members, invites) is untouched. Nothing here leaks a
 * Clerk id past the boundary; callers get a subject id and a verified email.
 */

/** The Clerk session subject (their stable user id), or null when signed out. */
export async function getClerkSubjectId(): Promise<string | null> {
  const { userId } = await auth();
  return userId;
}

/**
 * The signed-in user's primary verified email, or null. This hits Clerk's API,
 * so it's called only on the first-sign-in path (invite matching / bootstrap) —
 * never for a returning member we can already resolve by subject id.
 */
export async function getClerkVerifiedEmail(): Promise<string | null> {
  const user = await currentUser();
  return user?.primaryEmailAddress?.emailAddress ?? null;
}
