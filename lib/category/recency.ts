import type { Category, Transaction } from "@/types/budget";

/**
 * Map of `categoryId → most-recent transaction date` ("YYYY-MM-DD"), built in a
 * single pass over the full transaction list. Recency is defined by
 * **transaction activity**, not target edits (issue #166 story 3/4). A category
 * with no transactions is simply absent from the map — callers treat that as
 * "no activity". Mirrors `mostRecentTransactionInCategory`'s max-by-date rule;
 * the per-transaction id tiebreak there only picks *which* row, so the date it
 * yields is the same max this map stores.
 */
export function lastActivityByCategory(
  transactions: Transaction[],
): Map<string, string> {
  const map = new Map<string, string>();
  for (const t of transactions) {
    const current = map.get(t.categoryId);
    if (current === undefined || t.date > current) map.set(t.categoryId, t.date);
  }
  return map;
}

/**
 * Comparator that orders categories by most-recent activity, descending — so
 * the Categories ledger surfaces what changed since the last visit first (story
 * 3). Categories with no transactions sort last; ties (same last-activity date,
 * or both with none) break on name ascending so the order is stable across
 * renders. Pass the map from {@link lastActivityByCategory}.
 */
export function compareCategoriesByRecency(
  lastActivity: ReadonlyMap<string, string>,
): (a: Category, b: Category) => number {
  return (a, b) => {
    const da = lastActivity.get(a.id);
    const db = lastActivity.get(b.id);
    if (da !== undefined && db !== undefined) {
      if (da !== db) return da < db ? 1 : -1; // later date first
      return a.name.localeCompare(b.name);
    }
    if (da !== undefined) return -1; // active before inactive
    if (db !== undefined) return 1;
    return a.name.localeCompare(b.name);
  };
}

/**
 * Compact "last active" stamp for a category row (issue #166 story 4) — e.g.
 * "Today", "Yesterday", "3d ago", "2w ago". `dateIso` is a `"YYYY-MM-DD"`
 * calendar date (a transaction date, or the value from
 * {@link lastActivityByCategory}); `undefined` means the category has no
 * activity yet. Diff is computed in whole calendar days (both sides pinned to
 * UTC midnight so DST/timezone can't shift the count), and a future-dated row
 * (a bill dated ahead per story 26) reads "Today" rather than a negative age.
 */
export function relativeDayLabel(
  dateIso: string | undefined,
  now: Date,
): string {
  if (dateIso === undefined) return "No activity";
  const [y, m, d] = dateIso.split("-").map(Number);
  const then = Date.UTC(y, m - 1, d);
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const days = Math.round((today - then) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  if (days < 28) return `${Math.floor(days / 7)}w ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}
