/**
 * Single source of truth for the app's primary navigation. The shell
 * (desktop top bar, mobile bottom tab) reads from here; future routes
 * slot in by adding one entry.
 */

import {
  Activity,
  Flame,
  LayoutList,
  Receipt,
  Settings,
  TrendingUp,
  Wallet,
} from "lucide-react";

import type { NavItem } from "@/types/nav";

// Order here drives desktop nav (all items, left→right) and the mobile bottom
// tab (which additionally splits on `mobileTab`, preserving this order within
// each group). Tuned for the #166 desktop-entry / mobile-review split: mobile
// primaries are the review surfaces (Pulse, FIRE, Net worth, Transactions —
// story 14), while the data-entry / rarely-opened surfaces (Categories, Income,
// Settings — story 15) live in the More overflow. Keeps 4 primaries so
// BottomTabNav's `grid-cols-5` (4 + More) still fits.
export const NAV_ITEMS: readonly NavItem[] = [
  { label: "Pulse", href: "/", icon: Activity, mobileTab: "primary" },
  // Categories index reinstated in #166 (it was dropped in #79 when its job was
  // folded into Pulse + the /categories/[id] detail page). It's the working
  // ledger for per-category budgeting; on desktop it sits up front as a primary
  // entry surface (story 13), on mobile it's in More (review-only phone).
  { label: "Categories", href: "/categories", icon: LayoutList, mobileTab: "more" },
  // FIRE is live as of #110 — the "Soon" marker came off with chunk 6 (KPI
  // strip, live assumptions, projection chart), mirroring Net Worth (#109).
  { label: "FIRE", href: "/fire", icon: Flame, mobileTab: "primary" },
  { label: "Income", href: "/income", icon: Wallet, mobileTab: "more" },
  // Net Worth is live as of #109 — the "Soon" marker came off with chunk 9
  // (real accounts + a recorded-history trajectory).
  { label: "Net worth", href: "/net-worth", icon: TrendingUp, mobileTab: "primary" },
  { label: "Transactions", href: "/transactions", icon: Receipt, mobileTab: "primary" },
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
