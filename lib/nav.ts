/**
 * Single source of truth for the app's primary navigation. The shell
 * (desktop top bar, mobile bottom tab) reads from here; future routes
 * slot in by adding one entry.
 */

import type { NavItem } from "@/types/nav";

export const NAV_ITEMS: readonly NavItem[] = [
  { label: "Pulse", href: "/", icon: "📊", mobileTab: "primary" },
  // FIRE takes the slot vacated by the dropped Categories index (#79): category
  // management lives on Pulse + the /categories/[id] detail page, so the index
  // was redundant. FIRE is a marked placeholder — the feature is a future
  // discovery effort, but the slot signals the product's direction.
  { label: "FIRE", href: "/fire", icon: "🔥", mobileTab: "primary", placeholder: true },
  { label: "Income", href: "/income", icon: "💼", mobileTab: "primary" },
  { label: "Transactions", href: "/transactions", icon: "📜", mobileTab: "primary" },
  { label: "Net worth", href: "/net-worth", icon: "📈", mobileTab: "more", placeholder: true },
  { label: "Settings", href: "/settings", icon: "⚙️", mobileTab: "more" },
];

function stripQueryAndHash(pathname: string): string {
  const queryAt = pathname.indexOf("?");
  const hashAt = pathname.indexOf("#");
  const cut = [queryAt, hashAt].filter((i) => i >= 0);
  return cut.length === 0 ? pathname : pathname.slice(0, Math.min(...cut));
}

function stripTrailingSlash(pathname: string): string {
  return pathname.length > 1 && pathname.endsWith("/")
    ? pathname.slice(0, -1)
    : pathname;
}

/**
 * Whether `pathname` is "inside" `href` for nav-highlight purposes.
 *
 * - `"/"` matches only the exact root, not every nested route.
 * - Other hrefs match the exact path or any path starting with `href + "/"`.
 * - Query strings, hash fragments, and trailing slashes are normalised
 *   away before comparison.
 */
export function isActive(pathname: string, href: string): boolean {
  const path = stripTrailingSlash(stripQueryAndHash(pathname));
  const target = stripTrailingSlash(href);
  if (target === "/") return path === "/";
  return path === target || path.startsWith(target + "/");
}
