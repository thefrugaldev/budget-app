import { dayLabel } from "@/lib/budget";
import type { Transaction } from "@/types/budget";

/**
 * One transaction shown on its own — used when the row has no qualifying
 * streak peers within its day (no other transaction sharing the same
 * `(vendor, amount)`).
 */
export type SingleRow = {
  kind: "single";
  transaction: Transaction;
};

/**
 * Run of ≥ 2 transactions in the same day with the same `(vendor, amount)`.
 * Notes are intentionally *not* part of the streak key — twenty Whole Foods
 * $87.42 charges with varying free-text notes are still a streak; the
 * disclosure preserves each underlying row so the notes remain reachable.
 *
 * `amount` is signed (per `Transaction.amount`); a CollapsedStreak of two
 * −$10 refunds reports `amount: -10, count: 2`.
 */
export type CollapsedStreak = {
  kind: "streak";
  vendor: string;
  amount: number;
  count: number;
  transactionIds: string[];
};

export type TransactionRow = SingleRow | CollapsedStreak;

export type DayGroup = {
  /** "YYYY-MM-DD". */
  date: string;
  /** Human-readable: "Today" / "Yesterday" / "Mon, Jun 8" via `dayLabel`. */
  label: string;
  /** Signed sum across the day's rows; refunds reduce, all-refund days go negative. */
  subtotal: number;
  rows: TransactionRow[];
};

export type GroupOptions = {
  /** Anchor for "Today"/"Yesterday" copy on `label`. Defaults to `new Date()`. */
  today?: Date;
};

/**
 * Groups a transaction list into day buckets, newest-first. Within each day,
 * transactions sharing `(vendor, amount)` collapse into one `CollapsedStreak`
 * when their count is ≥ 2; lone transactions stay as `SingleRow`. Transactions
 * with no vendor (`undefined` / blank) never collapse — "20× of nothing"
 * would mislead, so each is emitted as its own `SingleRow`.
 *
 * Pure and deterministic. Date filtering is the caller's job — pass only the
 * transactions you want grouped, and the streak math naturally collapses on
 * the in-range count.
 *
 * Ordering:
 *   - Days: newest first by `date` (lexicographic on "YYYY-MM-DD" is correct).
 *   - Rows within a day: by the first-occurrence index of each
 *     `(vendor, amount)` bucket. Transactions sharing a key gather together
 *     regardless of where they appeared in the input — the streak displays
 *     where its first member did.
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

  const dates = [...byDate.keys()].sort((a, b) => (a < b ? 1 : a > b ? -1 : 0));

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
  amount: number;
  txns: Transaction[];
};

function collapseStreaks(transactions: Transaction[]): TransactionRow[] {
  const buckets = new Map<string, Bucket>();

  transactions.forEach((tx, idx) => {
    const vendor = tx.vendor?.trim();
    // No vendor → a unique key per transaction id, so it never groups with
    // anything (a single-element bucket stays a SingleRow).
    const key = vendor ? `v:${vendor}:${tx.amount}` : `solo:${tx.id}`;
    const existing = buckets.get(key);
    if (existing) existing.txns.push(tx);
    else
      buckets.set(key, {
        firstIdx: idx,
        vendor: vendor ?? "",
        amount: tx.amount,
        txns: [tx],
      });
  });

  return [...buckets.values()]
    .sort((a, b) => a.firstIdx - b.firstIdx)
    .map((b) =>
      b.vendor && b.txns.length >= 2
        ? {
            kind: "streak",
            vendor: b.vendor,
            amount: b.amount,
            count: b.txns.length,
            transactionIds: b.txns.map((t) => t.id),
          }
        : { kind: "single", transaction: b.txns[0] },
    );
}
