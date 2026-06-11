"use client";

import { useEffect } from "react";

/**
 * Root segment error boundary. Lives at `app/error.tsx` so it wraps
 * `app/page.tsx` and every nested route that does not declare its own
 * `error.tsx`. The boundary does NOT wrap `app/layout.tsx`, which means
 * the shell (header + bottom-tab nav) stays rendered above this fallback
 * and remains reachable — story 19.
 */
export default function Error({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-16 sm:py-24">
      <div className="rounded-2xl bg-card p-8 text-center ring-1 ring-border sm:p-12">
        <div aria-hidden className="mb-4 text-5xl">
          ⚠️
        </div>
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Something went wrong
        </p>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          We couldn&apos;t load this page
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          The rest of the app is still reachable from the nav. Try reloading
          this page, or pick another section.
        </p>
        {error.digest ? (
          <p className="mt-4 text-xs tabular-nums text-muted-foreground">
            Error ID: {error.digest}
          </p>
        ) : null}
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-6 rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background hover:bg-foreground/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Reload page
        </button>
      </div>
    </div>
  );
}
