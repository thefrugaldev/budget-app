import { SignOutButton } from "@clerk/nextjs";
import { Lock } from "lucide-react";

/**
 * Shown to a signed-in user who has no membership and no matching invite — the
 * deny-by-default outcome (story 6). It grants zero data access and renders no
 * app nav; the only affordance is signing out to try a different account. Part
 * of the sign-in-screen auth surface (ADR 0004), so it shares that seam's use
 * of the Clerk SDK for the sign-out control.
 */
export function PrivateAppScreen() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-6 py-16 text-center">
      <span className="flex size-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Lock className="size-7" aria-hidden />
      </span>
      <div className="max-w-md">
        <h1 className="font-heading text-display font-semibold tracking-tight text-foreground">
          This is a private app
        </h1>
        <p className="mt-3 text-muted-foreground">
          You&rsquo;re signed in, but this household hasn&rsquo;t invited this
          account. Ask the owner to invite your email, then sign in again.
        </p>
      </div>
      <SignOutButton redirectUrl="/sign-in">
        <button
          type="button"
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          Sign out
        </button>
      </SignOutButton>
    </main>
  );
}
