export type CategoryKind = "expense" | "savings";

export type Category = {
  id: string;
  name: string;
  emoji: string;
  kind: CategoryKind;
  /** Monthly cap (expense) or goal (savings), in USD. */
  monthly: number;
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
