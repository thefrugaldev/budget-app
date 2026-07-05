import { SignIn } from "@clerk/nextjs";

import type { Metadata } from "next";

export const metadata: Metadata = { title: "Sign in" };

// The sign-in screen — the third and last sanctioned Clerk-SDK site (ADR 0004).
// It renders bare (outside the `(app)` group, so no nav) and is themed to the
// Harvest identity via token-utility classNames rather than raw colors, so even
// the front door looks like the product (story 18). Google is the sole provider
// (configured in the Clerk dashboard, not here).
const appearance = {
  elements: {
    rootBox: "w-full",
    cardBox: "shadow-none",
    card: "bg-card border border-border rounded-2xl",
    headerTitle: "font-heading text-foreground",
    headerSubtitle: "text-muted-foreground",
    socialButtonsBlockButton:
      "border-border text-foreground hover:bg-muted transition-colors",
    formButtonPrimary:
      "bg-primary text-primary-foreground hover:bg-primary/90 transition-colors",
    footerActionLink: "text-primary hover:text-primary/90",
    footer: "hidden",
  },
} as const;

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect_url?: string }>;
}) {
  const { redirect_url } = await searchParams;
  // Only honor a same-origin path. The proxy always sets this to a same-origin
  // pathname, but a hand-crafted link could carry anything — reject absolute and
  // protocol-relative (`//evil.example`) URLs so this can't become an open
  // redirect after sign-in.
  const safeRedirect =
    redirect_url?.startsWith("/") && !redirect_url.startsWith("//")
      ? redirect_url
      : "/";

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 bg-background px-6 py-16">
      <div className="text-center">
        <h1 className="font-heading text-display font-semibold tracking-tight text-foreground">
          Budget
        </h1>
        <p className="mt-2 text-muted-foreground">
          Sign in to reach your household
        </p>
      </div>
      <SignIn
        appearance={appearance}
        // Return the user to where the proxy bounced them from (story 15),
        // falling back to Pulse.
        fallbackRedirectUrl={safeRedirect}
      />
    </main>
  );
}
