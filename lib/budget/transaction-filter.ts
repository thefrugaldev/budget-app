import type { Transaction } from "@/types/budget";

/**
 * Most-recent (by date, then insertion order) transaction in a category, used
 * to pre-fill `vendor` / `amount` / `note` on the Add Transaction form when
 * the user lands on a category with existing history (story 32). Returns
 * `undefined` for an empty category so callers can fall through to empty
 * defaults.
 *
 * Sign-aware: the absolute value is what the form's positive-only amount input
 * shows; the caller separately seeds the sign from the prefill transaction.
 */
export function mostRecentTransactionInCategory(
  transactions: Transaction[],
  categoryId: string,
): Transaction | undefined {
  // Tiebreaker on id (lexicographic, descending) so same-date rows have a
  // deterministic winner independent of input order — Mongo's sort isn't
  // stable across the same date, and React fixtures don't carry an order.
  let best: Transaction | undefined;
  for (const t of transactions) {
    if (t.categoryId !== categoryId) continue;
    if (!best) {
      best = t;
      continue;
    }
    if (t.date > best.date) best = t;
    else if (t.date === best.date && t.id > best.id) best = t;
  }
  return best;
}

/**
 * Frequency-ranked list of vendor strings for the autocomplete suggestion
 * popup (story 33). Vendors used in the selected category appear first
 * (ranked by count), then global vendors used elsewhere — deduped, blanks
 * dropped. Caller decides how many to show; the order is stable across
 * renders so the popup doesn't shift under the user.
 */
export function vendorSuggestionsForCategory(
  transactions: Transaction[],
  categoryId: string,
): string[] {
  const inCategory = new Map<string, number>();
  const global = new Map<string, number>();
  for (const t of transactions) {
    const v = t.vendor?.trim();
    if (!v) continue;
    global.set(v, (global.get(v) ?? 0) + 1);
    if (t.categoryId === categoryId) {
      inCategory.set(v, (inCategory.get(v) ?? 0) + 1);
    }
  }
  const byFreqDesc = (a: [string, number], b: [string, number]) =>
    b[1] - a[1] || a[0].localeCompare(b[0]);
  const localOrdered = [...inCategory.entries()].sort(byFreqDesc).map(([v]) => v);
  const seen = new Set(localOrdered);
  const globalOrdered = [...global.entries()]
    .sort(byFreqDesc)
    .map(([v]) => v)
    .filter((v) => !seen.has(v));
  return [...localOrdered, ...globalOrdered];
}

export type TransactionFilter = {
  text?: string;
  vendor?: string;
  dateFrom?: string;
  dateTo?: string;
  /**
   * Cross-category constraint for the global `/transactions` list (issue #17
   * chunk 5, story 18). When present and non-empty, only rows whose
   * `categoryId` is in the set pass; an empty array or `undefined` means
   * "all categories" (the category-detail list never sets it — its rows are
   * already scoped to one category).
   */
  categoryIds?: string[];
};

/**
 * Predicate behind the transaction filter row — the category-detail list
 * (stories 24, 64) and the global `/transactions` list (chunk 5).
 * Free-text matches `vendor` and `note` case-insensitively. `vendor` is an
 * exact-match constraint used by the vendor dropdown; an empty/undefined
 * value means "all vendors". `categoryIds` is the global list's category
 * multi-select — empty/undefined means "all categories". Date bounds are
 * inclusive ISO `YYYY-MM-DD` strings — lexicographic comparison is safe
 * given the fixed shape.
 */
export function matchesTransactionFilter(
  t: Transaction,
  f: TransactionFilter,
): boolean {
  if (f.dateFrom && t.date < f.dateFrom) return false;
  if (f.dateTo && t.date > f.dateTo) return false;
  if (f.vendor && t.vendor !== f.vendor) return false;
  if (f.categoryIds && f.categoryIds.length > 0 && !f.categoryIds.includes(t.categoryId)) {
    return false;
  }
  const text = f.text?.trim().toLowerCase();
  if (text) {
    const inVendor = t.vendor?.toLowerCase().includes(text) ?? false;
    const inNote = t.note?.toLowerCase().includes(text) ?? false;
    if (!inVendor && !inNote) return false;
  }
  return true;
}
