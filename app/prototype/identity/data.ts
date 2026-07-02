// PROTOTYPE — throwaway. Delete when #80 chunk 1 has a chosen direction.
//
// Realistic dashboard snapshot mirroring the seed data (lib/db/seed.ts) so the
// identity directions are judged against the app's true density — a full set of
// expense + savings categories, a lived monthly history, and honest KPIs — not
// a vacuum. No production data model is imported; these are plain literals.

import {
  BarChart3,
  Briefcase,
  Clapperboard,
  Fuel,
  Home,
  Landmark,
  Plane,
  ShoppingBag,
  ShoppingCart,
  TrendingUp,
  Umbrella,
  Utensils,
  Zap,
  type LucideIcon,
} from "lucide-react";

// Types below are intentionally NOT exported: the prototype stays hermetic so
// no named type crosses a file boundary (keeps `pnpm lint:types` green without
// polluting types/ with throwaway shapes). Direction files derive the category
// shape structurally via `(typeof EXPENSES)[number]`.
type ProtoKind = "expense" | "savings";

type ProtoCategory = {
  id: string;
  name: string;
  kind: ProtoKind;
  /** Coherent, palette-tintable icon replacing the seed emoji (story 4). */
  Icon: LucideIcon;
  /** Signed in-range total, matching the app's signed-amount convention. */
  total: number;
  /** Resolved monthly target / cap. */
  target: number;
  /** 6-month recent activity, for sparklines. */
  trend: number[];
};

export const EXPENSES: ProtoCategory[] = [
  { id: "rent", name: "Rent", kind: "expense", Icon: Home, total: 2200, target: 2200, trend: [2200, 2200, 2200, 2200, 2200, 2200] },
  { id: "groceries", name: "Groceries", kind: "expense", Icon: ShoppingCart, total: 642, target: 800, trend: [690, 760, 720, 410, 340, 642] },
  { id: "dining", name: "Dining out", kind: "expense", Icon: Utensils, total: 287, target: 300, trend: [195, 310, 280, 142, 136, 287] },
  { id: "gas", name: "Gas", kind: "expense", Icon: Fuel, total: 205, target: 180, trend: [0, 0, 175, 195, 49, 205] },
  { id: "utilities", name: "Utilities", kind: "expense", Icon: Zap, total: 142, target: 220, trend: [268, 245, 210, 165, 188, 142] },
  { id: "shopping", name: "Shopping", kind: "expense", Icon: ShoppingBag, total: 260, target: 200, trend: [0, 320, 0, 75, 220, 260] },
  { id: "entertainment", name: "Entertainment", kind: "expense", Icon: Clapperboard, total: 95, target: 150, trend: [95, 0, 0, 60, 35, 95] },
  { id: "travel", name: "Travel", kind: "expense", Icon: Plane, total: 0, target: 250, trend: [0, 0, 680, 0, 412, 0] },
];

export const SAVINGS: ProtoCategory[] = [
  { id: "hysa", name: "HYSA", kind: "savings", Icon: Landmark, total: 800, target: 800, trend: [800, 800, 800, 800, 800, 800] },
  { id: "brokerage", name: "Brokerage", kind: "savings", Icon: TrendingUp, total: 600, target: 600, trend: [600, 600, 600, 600, 600, 600] },
  { id: "vacation", name: "Vacation fund", kind: "savings", Icon: Umbrella, total: 250, target: 200, trend: [0, 0, 0, 0, 250, 250] },
];

export const INCOME = {
  Icon: Briefcase,
  label: "Salary",
  monthly: 7500,
  /** Plus a one-time RSU vest this month (story: mixed income kinds). */
  rsuIcon: BarChart3,
  rsu: 12500,
};

const expenseTotal = EXPENSES.reduce((s, c) => s + c.total, 0); // 3831
const savingsTotal = SAVINGS.reduce((s, c) => s + c.total, 0); // 1650
const expenseTarget = EXPENSES.reduce((s, c) => s + c.target, 0); // 4300
const savingsTarget = SAVINGS.reduce((s, c) => s + c.target, 0); // 1600

export const KPIS = {
  spent: expenseTotal,
  spentTarget: expenseTarget,
  saved: savingsTotal,
  savedTarget: savingsTarget,
  income: INCOME.monthly,
  /** saved / income */
  savingsRate: savingsTotal / INCOME.monthly, // 0.22
  remaining: expenseTarget - expenseTotal, // 469
};

/** 6-month history for the "progress against targets over time" signatures. */
export type MonthPoint = {
  label: string;
  spend: number;
  saved: number;
  /** saved / income that month, for the pulse trace. */
  rate: number;
};

export const MONTHLY: MonthPoint[] = [
  { label: "Jan", spend: 4090, saved: 1600, rate: 0.19 },
  { label: "Feb", spend: 4180, saved: 1600, rate: 0.23 },
  { label: "Mar", spend: 4360, saved: 1600, rate: 0.2 },
  { label: "Apr", spend: 3720, saved: 1600, rate: 0.25 },
  { label: "May", spend: 4210, saved: 1650, rate: 0.21 },
  { label: "Jun", spend: 3831, saved: 1650, rate: 0.22 },
];

export const EXPENSE_TARGET_LINE = expenseTarget; // steady monthly cap
export const SAVINGS_TARGET_LINE = savingsTarget;

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

export const fmt = (n: number) => currency.format(n);
export const pct = (n: number) => `${Math.round(n * 100)}%`;

/**
 * Threshold state with the expense/savings meaning-flip, plus a text
 * descriptor — status never rides on color alone (AGENTS accessibility
 * baseline). Ratio is total/target.
 */
type ThresholdState = "under" | "near" | "at" | "over";

export function thresholdState(kind: ProtoKind, total: number, target: number): ThresholdState {
  if (target === 0) return "under";
  const r = total / target;
  if (r >= 1.05) return "over";
  if (r >= 0.98) return "at";
  if (r >= 0.85) return "near";
  return "under";
}

/** Tone is the meaning, not the raw state: `over` is bad for expense, good for savings. */
type Tone = "good" | "warn" | "bad" | "neutral";

export function toneFor(kind: ProtoKind, state: ThresholdState): Tone {
  if (kind === "savings") {
    if (state === "over" || state === "at") return "good";
    if (state === "near") return "warn";
    return "neutral";
  }
  if (state === "over") return "bad";
  if (state === "at" || state === "near") return "warn";
  return "good";
}

export function descriptorFor(kind: ProtoKind, state: ThresholdState): string {
  if (kind === "savings") {
    return { under: "Building", near: "Close", at: "Funded", over: "Ahead" }[state];
  }
  return { under: "On track", near: "Close", at: "At cap", over: "Over" }[state];
}
