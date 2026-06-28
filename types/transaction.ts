import type { Transaction } from "./budget";

/**
 * Transaction-list filter set, shared by the filter row, the list, and the URL
 * seam (`@/lib/budget`). Every field is optional; an absent field means "no
 * constraint".
 */
export type TransactionFilter = {
  text?: string;
  vendor?: string;
  dateFrom?: string;
  dateTo?: string;
  /**
   * Cross-category constraint for the global `/transactions` list. A non-empty
   * set keeps only rows whose `categoryId` is in it; empty/undefined means
   * "all categories".
   */
  categoryIds?: string[];
};

/**
 * One transaction shown on its own — used when the row has no qualifying streak
 * peers within its day (no other transaction sharing the same vendor).
 */
export type SingleRow = {
  kind: "single";
  transaction: Transaction;
};

/**
 * Run of ≥ 2 transactions at the same vendor in the same day, regardless of
 * amount. `subtotal` is the signed sum (refunds net); `amount` is set only when
 * every member shares one amount (the uniform-duplicate case), enabling a
 * per-unit "N× $X" display, and is undefined when amounts vary.
 */
export type CollapsedStreak = {
  kind: "streak";
  vendor: string;
  count: number;
  subtotal: number;
  amount?: number;
  transactionIds: string[];
};

export type TransactionRow = SingleRow | CollapsedStreak;

export type DayGroup = {
  /** "YYYY-MM-DD". */
  date: string;
  /** Human-readable: "Today" / "Yesterday" / "Mon, Jun 8". */
  label: string;
  /** Signed sum across the day's rows; refunds reduce, all-refund days go negative. */
  subtotal: number;
  rows: TransactionRow[];
};

export type GroupOptions = {
  /** Anchor for "Today"/"Yesterday" copy on `label`. Defaults to `new Date()`. */
  today?: Date;
};
