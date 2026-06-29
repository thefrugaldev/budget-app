import { dayLabel } from "@/lib/budget";
import type { Transaction } from "@/types/budget";
import type {
  DayGroup,
  GroupOptions,
  TransactionRow,
} from "@/types/transaction";

/**
 * Groups a transaction list into day buckets, newest-first. Within each day,
 * transactions sharing a `vendor` collapse into one `CollapsedStreak` when
 * their count is ≥ 2 (whatever their amounts); lone transactions stay as
 * `SingleRow`. Transactions with no vendor (`undefined` / blank) never
 * collapse — "3× of nothing" would mislead, so each is emitted as its own
 * `SingleRow`.
 *
 * Pure and deterministic. Date filtering is the caller's job — pass only the
 * transactions you want grouped, and the streak math naturally collapses on
 * the in-range count.
 *
 * Ordering:
 *   - Days: newest first by `date` (lexicographic on "YYYY-MM-DD" is correct).
 *   - Rows within a day: by the first-occurrence index of each `vendor`
 *     bucket. Transactions sharing a vendor gather together regardless of
 *     where they appeared in the input — the streak displays where its first
 *     member did.
 *
 * Intra-day output is only as deterministic as the input: with the same set
 * of transactions in a different order, `firstIdx` and `transactionIds` will
 * shift. Callers that need cross-call stability (React keys, "primary" id
 * picks) should pre-sort the list — by `id`, repository-side sort key, or
 * similar — before passing it in.
 */
export function groupTransactionsByDay(
  transactions: Transaction[],
  options: GroupOptions = {},
): DayGroup[] {
  const today = options.today ?? new Date();

  // Bucket by date. The slice keeps us safe if a future schema lets a time
  // component leak in; today the field is already "YYYY-MM-DD".
  const byDate = new Map<string, Transaction[]>();
  for (const t of transactions) {
    const date = t.date.slice(0, 10);
    const bucket = byDate.get(date);
    if (bucket) bucket.push(t);
    else byDate.set(date, [t]);
  }

  const dates = [...byDate.keys()].sort((a, b) => b.localeCompare(a));

  return dates.map((date) => {
    const txns = byDate.get(date)!;
    return {
      date,
      label: dayLabel(date, today),
      subtotal: txns.reduce((s, t) => s + t.amount, 0),
      rows: collapseStreaks(txns),
    };
  });
}

type Bucket = {
  firstIdx: number;
  vendor: string;
  txns: Transaction[];
};

function collapseStreaks(transactions: Transaction[]): TransactionRow[] {
  const buckets = new Map<string, Bucket>();

  transactions.forEach((tx, idx) => {
    const vendor = tx.vendor?.trim();
    // Key by vendor alone — a vendor's transactions on a day collapse together
    // whatever their amounts. No vendor → a unique key per transaction id, so
    // blank-vendor rows never group (a single-element bucket stays a SingleRow).
    const key = vendor ? `v:${vendor}` : `solo:${tx.id}`;
    const existing = buckets.get(key);
    if (existing) existing.txns.push(tx);
    else buckets.set(key, { firstIdx: idx, vendor: vendor ?? "", txns: [tx] });
  });

  return [...buckets.values()]
    .sort((a, b) => a.firstIdx - b.firstIdx)
    .map((b): TransactionRow => {
      if (!b.vendor || b.txns.length < 2) {
        return { kind: "single", transaction: b.txns[0] };
      }
      const amounts = b.txns.map((t) => t.amount);
      const uniform = amounts.every((a) => a === amounts[0]);
      return {
        kind: "streak",
        vendor: b.vendor,
        count: b.txns.length,
        subtotal: amounts.reduce((s, a) => s + a, 0),
        amount: uniform ? amounts[0] : undefined,
        transactionIds: b.txns.map((t) => t.id),
      };
    });
}

/**
 * Stable navigable key for a collapsed streak header. A streak is unique per
 * `(date, vendor)` within a day group, so this key identifies it across the
 * roving-tabindex order and the expanded-streak set in the list UI.
 */
export function streakKey(date: string, vendor: string): string {
  return `streak:${date}:${vendor}`;
}

/**
 * Flattens day groups into the keyboard-navigable row order used by the
 * transaction list's roving-tabindex. A single row contributes its transaction
 * id; a streak header contributes its `streakKey`, followed — only when open —
 * by each underlying row id that still exists (a row optimistically deleted
 * mid-streak drops out via `hasTransaction`). The order matches the rendered
 * DOM exactly so arrow / Home / End navigation lands on real elements.
 *
 * `sectionIndexByKey` maps each navigable key back to the index of its day
 * group. When the list is virtualized, a key whose section is windowed out has
 * no DOM node to focus; the caller scrolls `sectionIndexByKey.get(key)` into
 * view first, then focuses once it mounts. It also lets the caller answer
 * "is this key rendered?" and "does this key exist?" in O(1) rather than
 * scanning `orderedRowKeys`.
 *
 * `sectionFirstKeys[i]` is the first navigable key of day group `i` — the
 * natural roving tab stop when the active row has been scrolled out of the
 * window, resolved in O(1) from the topmost rendered section index instead of
 * a linear search for the first rendered key. Every day group has at least one
 * row, so every index is populated. Pure and deterministic given its inputs.
 */
export function flattenNavigableRows(
  dayGroups: DayGroup[],
  isStreakOpen: (key: string) => boolean,
  hasTransaction: (id: string) => boolean,
): {
  orderedRowKeys: string[];
  sectionIndexByKey: Map<string, number>;
  sectionFirstKeys: string[];
} {
  const orderedRowKeys: string[] = [];
  const sectionIndexByKey = new Map<string, number>();
  const sectionFirstKeys: string[] = [];

  dayGroups.forEach((group, sectionIndex) => {
    const push = (key: string) => {
      orderedRowKeys.push(key);
      sectionIndexByKey.set(key, sectionIndex);
      if (sectionFirstKeys[sectionIndex] === undefined) {
        sectionFirstKeys[sectionIndex] = key;
      }
    };
    for (const row of group.rows) {
      if (row.kind === "single") {
        push(row.transaction.id);
      } else {
        const key = streakKey(group.date, row.vendor);
        push(key);
        if (isStreakOpen(key)) {
          for (const id of row.transactionIds) {
            if (hasTransaction(id)) push(id);
          }
        }
      }
    }
  });

  return { orderedRowKeys, sectionIndexByKey, sectionFirstKeys };
}
