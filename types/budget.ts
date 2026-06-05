export type Category = {
  id: string;
  name: string;
};

export type Transaction = {
  id: string;
  categoryId: string;
  amount: number;
  date: string; // ISO date, e.g. "2026-06-05"
  note?: string;
};

export type MonthlySpendByCategory = {
  categoryId: string;
  categoryName: string;
  total: number;
};
