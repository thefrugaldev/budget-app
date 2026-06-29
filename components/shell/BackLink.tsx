import { ArrowLeft } from "lucide-react";
import Link from "next/link";

/**
 * A "back to <somewhere>" affordance for detail pages that aren't a nav
 * destination themselves (e.g. /categories/[id]). Gives the user a clear way
 * back to where they came from, since no bottom-tab/top-nav item is active on
 * such pages.
 */
export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md"
    >
      <ArrowLeft className="size-4" aria-hidden />
      {label}
    </Link>
  );
}
