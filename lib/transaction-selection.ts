import type { DayGroup, TransactionRow } from "@/lib/transaction";
import type { Transaction } from "@/types/budget";

/**
 * Pure selection algebra for the transaction list's bulk-operation mode
 * (issue #17 chunk 4). The `useTransactionSelection` hook is a thin
 * `useState<Set<string>>` wrapper over these functions — keeping the set
 * manipulation here (rather than inline in the hook) makes the behaviour the
 * PRD calls out for coverage — select-many, select-all, and "selecting a
 * collapsed streak selects every underlying id" — testable without a DOM.
 *
 * Every mutator returns a fresh `Set`, so React sees a new reference and the
 * hook re-renders; the input set is never mutated.
 */

/** Toggle a single transaction id in/out of the selection. */
export function withToggled(
  selected: ReadonlySet<string>,
  id: string,
): Set<string> {
  const next = new Set(selected);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

/** Add every id to the selection (idempotent). Backs `selectMany` / select-all. */
export function withAdded(
  selected: ReadonlySet<string>,
  ids: readonly string[],
): Set<string> {
  const next = new Set(selected);
  for (const id of ids) next.add(id);
  return next;
}

/** Remove every id from the selection. Backs `deselectMany` / clearing a day. */
export function withRemoved(
  selected: ReadonlySet<string>,
  ids: readonly string[],
): Set<string> {
  const next = new Set(selected);
  for (const id of ids) next.delete(id);
  return next;
}

/**
 * True when `ids` is non-empty and every one is selected — drives the checked
 * state of a day-header / top-level select-all box. Empty `ids` is `false`
 * (an empty group's box isn't "all selected").
 */
export function areAllSelected(
  selected: ReadonlySet<string>,
  ids: readonly string[],
): boolean {
  return ids.length > 0 && ids.every((id) => selected.has(id));
}

/**
 * True when at least one of `ids` is selected but not all — the indeterminate
 * state for a select-all box (the dash, not the tick).
 */
export function areSomeSelected(
  selected: ReadonlySet<string>,
  ids: readonly string[],
): boolean {
  const hit = ids.filter((id) => selected.has(id)).length;
  return hit > 0 && hit < ids.length;
}

/**
 * The transaction ids a single list row represents: one for a `single` row,
 * all underlying ids for a `streak` row. Selecting a collapsed streak selects
 * every transaction beneath it (story, "selecting a collapsed streak selects
 * all underlying ids").
 */
export function rowIds(row: TransactionRow): string[] {
  return row.kind === "streak" ? [...row.transactionIds] : [row.transaction.id];
}

/** Every transaction id within a day group (across single + streak rows). */
export function dayGroupIds(group: DayGroup): string[] {
  return group.rows.flatMap(rowIds);
}

/** Every transaction id across all day groups — backs the top-level select-all. */
export function allTransactionIds(groups: readonly DayGroup[]): string[] {
  return groups.flatMap(dayGroupIds);
}

/**
 * The most-common non-blank vendor among the selected transactions, used to
 * prefill the bulk vendor-rename input (story 14). Ties resolve to whichever
 * tied vendor appears first in `transactions` (the array as passed in — the
 * caller decides that order). Returns undefined when no selected row has a
 * vendor.
 */
export function mostCommonVendor(
  transactions: readonly Transaction[],
  selected: ReadonlySet<string>,
): string | undefined {
  const counts = new Map<string, number>();
  for (const t of transactions) {
    if (!selected.has(t.id)) continue;
    const vendor = t.vendor?.trim();
    if (!vendor) continue;
    counts.set(vendor, (counts.get(vendor) ?? 0) + 1);
  }
  let best: string | undefined;
  let bestCount = 0;
  for (const [vendor, count] of counts) {
    if (count > bestCount) {
      best = vendor;
      bestCount = count;
    }
  }
  return best;
}

/**
 * Signed sum of the selected transactions' amounts — the running total shown
 * on the bulk action bar and in the delete confirmation. Refunds (negative)
 * net against purchases, matching the day-subtotal convention (ADR 0001).
 */
export function selectedTotal(
  transactions: readonly Transaction[],
  selected: ReadonlySet<string>,
): number {
  let total = 0;
  for (const t of transactions) {
    if (selected.has(t.id)) total += t.amount;
  }
  return total;
}
