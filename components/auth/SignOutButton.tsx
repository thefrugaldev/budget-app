"use client";

import { SignOutButton as ClerkSignOutButton } from "@clerk/nextjs";

import { Button } from "@/components/ui/button";

/**
 * Sign-out control for Settings → Profile (#111 chunk 6, story 12).
 *
 * This is a sanctioned Clerk-SDK site: sign-out belongs to the *auth screens*
 * touchpoint of the ADR 0004 seam, the symmetric counterpart to the sign-in
 * screen (both are authentication UI, not the domain modeling the seam guards
 * against). Clearing Clerk's httpOnly session cookie needs the SDK, so the
 * import lives here rather than being faked away. On sign-out Clerk redirects
 * to `/sign-in` — the proxy would bounce a now-signed-out request there anyway,
 * but redirecting explicitly avoids a flash of the gated shell.
 */
export function SignOutButton() {
  return (
    <ClerkSignOutButton redirectUrl="/sign-in">
      <Button variant="outline">Sign out</Button>
    </ClerkSignOutButton>
  );
}
