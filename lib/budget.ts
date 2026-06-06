import type { Category, Transaction } from "@/types/budget";

export function fmt(amount: number): string {
  return amount.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: amount >= 100 ? 0 : 2,
  });
}

export function fmtExact(amount: number): string {
  return amount.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export function dayLabel(iso: string, today = new Date()): string {
  const todayIso = today.toISOString().slice(0, 10);
  if (iso === todayIso) return "Today";
  const y = new Date(today);
  y.setUTCDate(today.getUTCDate() - 1);
  if (iso === y.toISOString().slice(0, 10)) return "Yesterday";
  return new Date(iso + "T00:00:00Z").toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export function monthLabel(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function monthLabelShort(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleString("en-US", { month: "short", timeZone: "UTC" });
}

export function currentMonthKey(today = new Date()): string {
  return `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function currentYearStart(today = new Date()): string {
  return `${today.getUTCFullYear()}-01-01`;
}

export type ThresholdState = "under" | "near" | "at" | "over";

/**
 * Expense thresholds count toward the cap (over = bad). Savings thresholds
 * count toward the goal (over = good). The state vocabulary is shared but the
 * meaning of each state depends on `category.kind` — pair this with
 * `thresholdColor()` to translate to UI colors.
 */
export function thresholdFor(cat: Category, monthlyAmount: number): ThresholdState {
  const pct = cat.monthly === 0 ? 0 : monthlyAmount / cat.monthly;
  if (cat.kind === "expense") {
    if (pct < 0.7) return "under";
    if (pct < 0.9) return "near";
    if (pct <= 1.0) return "at";
    return "over";
  }
  if (pct >= 1.0) return "over";
  if (pct >= 0.9) return "at";
  if (pct >= 0.7) return "near";
  return "under";
}

export type ThresholdPalette = {
  text: string;
  bg: string;
  ring: string;
  dot: string;
  bar: string;
};

const PALETTE = {
  green: { text: "text-emerald-700 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-950/40", ring: "ring-emerald-200 dark:ring-emerald-900", dot: "bg-emerald-500", bar: "bg-emerald-500" },
  yellow: { text: "text-amber-700 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-950/40", ring: "ring-amber-200 dark:ring-amber-900", dot: "bg-amber-500", bar: "bg-amber-500" },
  orange: { text: "text-orange-700 dark:text-orange-400", bg: "bg-orange-50 dark:bg-orange-950/40", ring: "ring-orange-200 dark:ring-orange-900", dot: "bg-orange-500", bar: "bg-orange-500" },
  red: { text: "text-rose-700 dark:text-rose-400", bg: "bg-rose-50 dark:bg-rose-950/40", ring: "ring-rose-200 dark:ring-rose-900", dot: "bg-rose-500", bar: "bg-rose-500" },
} satisfies Record<string, ThresholdPalette>;

export function thresholdColor(kind: Category["kind"], state: ThresholdState): ThresholdPalette {
  if (kind === "expense") {
    return { under: PALETTE.green, near: PALETTE.yellow, at: PALETTE.orange, over: PALETTE.red }[state];
  }
  return { under: PALETTE.red, near: PALETTE.orange, at: PALETTE.yellow, over: PALETTE.green }[state];
}

export function ytdTotalsByCategory(
  transactions: Transaction[],
  categories: Category[],
  today = new Date(),
): Map<string, number> {
  const yearStart = currentYearStart(today);
  const todayIso = today.toISOString().slice(0, 10);
  const totals = new Map<string, number>();
  for (const c of categories) totals.set(c.id, 0);
  for (const t of transactions) {
    if (t.date < yearStart || t.date > todayIso) continue;
    totals.set(t.categoryId, (totals.get(t.categoryId) ?? 0) + t.amount);
  }
  return totals;
}

export function monthTotalsByCategory(
  transactions: Transaction[],
  categories: Category[],
  ym: string,
): Map<string, number> {
  const totals = new Map<string, number>();
  for (const c of categories) totals.set(c.id, 0);
  for (const t of transactions) {
    if (!t.date.startsWith(ym)) continue;
    totals.set(t.categoryId, (totals.get(t.categoryId) ?? 0) + t.amount);
  }
  return totals;
}

export function monthlyTotalsLastN(
  transactions: Transaction[],
  categoryId: string,
  n: number,
  today = new Date(),
): { ym: string; total: number }[] {
  const out: { ym: string; total: number }[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - i, 1));
    const ym = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    const total = transactions
      .filter((t) => t.categoryId === categoryId && t.date.startsWith(ym))
      .reduce((s, t) => s + t.amount, 0);
    out.push({ ym, total });
  }
  return out;
}
