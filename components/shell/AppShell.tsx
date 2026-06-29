import Link from "next/link";

import { BottomTabNav } from "./bottom-tab-nav/BottomTabNav";
import { PrimaryNav } from "./PrimaryNav";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-foreground focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-background focus:ring-2 focus:ring-ring focus:ring-offset-2"
      >
        Skip to content
      </a>
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-6 px-6">
          {/* Equal-width flex-1 side slots keep the desktop nav truly centred.
              The right slot is now an empty spacer — the theme control moved to
              Settings → Appearance (#81 chunk 2) — but it stays to preserve the
              centring. On mobile the nav is hidden, leaving just the brand. */}
          <div className="flex flex-1 items-center">
            <Link
              href="/"
              className="font-heading text-lg font-semibold tracking-tight"
            >
              Budget
            </Link>
          </div>
          <div className="hidden md:block">
            <PrimaryNav />
          </div>
          <div aria-hidden className="flex flex-1 items-center justify-end" />
        </div>
      </header>
      <main id="main-content" className="flex-1 pb-16 md:pb-0">
        {children}
      </main>
      <BottomTabNav />
    </>
  );
}
