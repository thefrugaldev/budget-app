export type CategoryKind = "expense" | "savings";

export type Category = {
  id: string;
  name: string;
  emoji: string;
  kind: CategoryKind;
  /** Monthly cap (expense) or goal (savings), in USD. */
  monthly: number;
  /** Inclusive lower bound, "YYYY-MM". Undefined means "always active". */
  activeFrom?: string;
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
  amount: number;
  date: string; // ISO date, e.g. "2026-06-05"
  vendor?: string;
  note?: string;
  items?: string[];
};

export type MonthlySpendByCategory = {
  categoryId: string;
  categoryName: string;
  total: number;
};
