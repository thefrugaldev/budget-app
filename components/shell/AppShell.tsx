import Link from "next/link";

import { BottomTabNav } from "./bottom-tab-nav/BottomTabNav";
import { PrimaryNav } from "./PrimaryNav";
import { ThemeToggle } from "./ThemeToggle";

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
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-6 px-6">
          <Link
            href="/"
            className="font-heading text-lg font-semibold tracking-tight"
          >
            Budget
          </Link>
          {/* Desktop-only nav. On mobile the bottom-tab nav owns navigation, so
              this is hidden and the header keeps brand (left) + theme toggle
              (right). `md:contents` lets the nav sit centred between them on
              desktop via the row's justify-between. */}
          <div className="hidden md:contents">
            <PrimaryNav />
          </div>
          <ThemeToggle />
        </div>
      </header>
      <main id="main-content" className="flex-1 pb-16 md:pb-0">
        {children}
      </main>
      <BottomTabNav />
    </>
  );
}
