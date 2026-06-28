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
