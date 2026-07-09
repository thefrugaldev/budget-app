import type { Filter } from "mongodb";

/**
 * The filter that decides which docs a danger-zone reset deletes (#118 chunk 5,
 * story 14). By default, documents synced from the Excel archive (those
 * carrying an `importRef`) are **spared** — a destructive "Clear all data" must
 * not silently erase years of imported history. The explicit opt-in
 * (`includeImported`) drops the filter so everything in the household goes.
 *
 * Pure and dependency-free (only a type-only `mongodb` import, which erases) so
 * it lives apart from `reset.ts`'s `server-only` chain and can be exercised
 * directly in tests — the spare-imported invariant is the load-bearing part.
 */
export function resetDeletionFilter<T extends { importRef?: string }>(
  includeImported: boolean,
): Filter<T> {
  return (includeImported ? {} : { importRef: { $exists: false } }) as Filter<T>;
}
