export type CategoryKind = "expense" | "savings" | "income";

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
