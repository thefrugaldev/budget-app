/**
 * Single source of truth for the app's primary navigation. The shell
 * (desktop top bar, mobile bottom tab) reads from here; future routes
 * slot in by adding one entry.
 */

import { Activity, Flame, Receipt, Settings, TrendingUp, Wallet } from "lucide-react";

import type { NavItem } from "@/types/nav";

export const NAV_ITEMS: readonly NavItem[] = [
  { label: "Pulse", href: "/", icon: Activity, mobileTab: "primary" },
  // FIRE takes the slot vacated by the dropped Categories index (#79): category
  // management lives on Pulse + the /categories/[id] detail page, so the index
  // was redundant. Live as of #110 — the "Soon" marker came off with chunk 6
  // (the page now renders the KPI strip, live assumptions, and the projection
  // chart), mirroring how Net Worth's marker came off with #109.
  { label: "FIRE", href: "/fire", icon: Flame, mobileTab: "primary" },
  { label: "Income", href: "/income", icon: Wallet, mobileTab: "primary" },
  { label: "Transactions", href: "/transactions", icon: Receipt, mobileTab: "primary" },
  // Net Worth is live as of #109 — the "Soon" marker came off with chunk 9
  // (the page now renders real accounts and a recorded-history trajectory).
  { label: "Net worth", href: "/net-worth", icon: TrendingUp, mobileTab: "more" },
  { label: "Settings", href: "/settings", icon: Settings, mobileTab: "more" },
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
