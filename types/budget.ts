export type CategoryKind = "expense" | "savings" | "income";

/**
 * Pay schedule for a recurring income source. Drives the lived-denomination
 * display on `/income` cards and paycheck-aware YTD pro-ration on Pulse (#46).
 * Only meaningful for `kind: "income"` sources; chunk 2 of #46 adds the
 * optional `payCadence` field to `Category`.
 */
export type PayCadence = "weekly" | "bi-weekly" | "semi-monthly" | "monthly";

/**
 * Row status for an income source on `/income`. Derived from the source's
 * lifecycle + target history by `classifyIncomeSourceStatus` (`lib/income.ts`)
 * and consumed by the card + status pill. "active" is the default (no pill);
 * "scheduled-change" and "ended" are the exception states.
 */
export type IncomeSourceStatus = "active" | "scheduled-change" | "ended";

export type Category = {
  id: string;
  name: string;
  emoji: string;
  kind: CategoryKind;
  /** Inclusive lower bound, "YYYY-MM". */
  activeFrom: string;
  /** Inclusive upper bound, "YYYY-MM". Undefined means "no end". */
  activeUntil?: string;
};

/**
 * Effective-dated monthly target for a category. The target in effect for
 * month M is the row with the greatest `effectiveFrom <= M`.
 */
export type CategoryTarget = {
  categoryId: string;
  monthly: number;
  effectiveFrom: string; // "YYYY-MM"
};

export type Transaction = {
  id: string;
  categoryId: string;
  /** Signed. Positive = spend / contribution / income received. Negative =
   * refund / withdrawal / income reversed. Monthly totals may be negative. */
  amount: number;
  date: string; // ISO date, e.g. "2026-06-05"
  vendor?: string;
  note?: string;
};

export type MonthlySpendByCategory = {
  categoryId: string;
  categoryName: string;
  total: number;
};
