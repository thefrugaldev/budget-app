import type { Metadata } from "next";

import { AddCategoryTile } from "@/components/budget/category/AddCategoryTile";
import { AddMenu } from "@/components/budget/AddMenu";
import { CategoryCard } from "@/components/budget/category/CategoryCard";
import { HeaderIncome } from "@/components/budget/HeaderIncome";
import { RangeSelector } from "@/components/budget/RangeSelector";
import {
  aggregateRange,
  computeIncomeForRange,
  computeSavingsRate,
  currentMonthKey,
  fmt,
  isCategoryActiveInRange,
  isRangePreset,
  rangeLabel,
  resolveRange,
  resolveTargetForMonth,
  type RangePreset,
} from "@/lib/budget";
import { ensureSeeded } from "@/lib/db/seed";
import { listCategories } from "@/lib/repositories/categories";
import { listCategoryTargets } from "@/lib/repositories/categoryTargets";
import { listAllTransactions } from "@/lib/repositories/transactions";

// Hardcoded full title (not just "Pulse"): Next's title.template in the root
// layout doesn't apply to a page in the same route segment.
export const metadata: Metadata = {
  title: "Pulse — Budget",
};

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ range?: string | string[] }>;
}) {
  await ensureSeeded();
  const [{ range: rangeParam }, categories, targets, transactions] = await Promise.all([
    searchParams,
    listCategories(),
    listCategoryTargets(),
    listAllTransactions(),
  ]);

  const raw = Array.isArray(rangeParam) ? rangeParam[0] : rangeParam;
  const preset: RangePreset = isRangePreset(raw) ? raw : "this-month";
  const now = new Date();
  const range = resolveRange(preset, now);
  const thisMonth = currentMonthKey(now);

  const aggregates = aggregateRange(
    transactions,
    categories,
    range.ymStart,
    range.ymEnd,
    targets,
  );
  const aggregateById = new Map(aggregates.map((row) => [row.categoryId, row]));

  // Story 11: hide categories whose lifecycle doesn't overlap the active range
  // from the overview. The detail page still loads them by id (story 12), so a
  // user can always navigate back into an ended category's history.
  const inRange = categories.filter((c) =>
    isCategoryActiveInRange(c, range.ymStart, range.ymEnd),
  );
  const expenses = inRange.filter((c) => c.kind === "expense");
  const savings = inRange.filter((c) => c.kind === "savings");
  // Income aggregation continues to read from the unfiltered category set so
  // current-month baselines include sources that pre-date or post-date the
  // selected range.
  const incomeCategories = categories.filter((c) => c.kind === "income");

  const expenseTotal = expenses.reduce(
    (s, c) => s + (aggregateById.get(c.id)?.total ?? 0),
    0,
  );
  const savingsTotal = savings.reduce(
    (s, c) => s + (aggregateById.get(c.id)?.total ?? 0),
    0,
  );
  const incomeForRange = computeIncomeForRange(
    incomeCategories,
    targets,
    transactions,
    range.ymStart,
    range.ymEnd,
    now,
  );
  const savingsRate = computeSavingsRate(incomeForRange, savingsTotal);
  const rangeText = rangeLabel(preset);

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-10 pb-[calc(9rem+env(safe-area-inset-bottom))] md:pb-28">
      <header className="mb-6 flex items-start justify-between gap-4">
        <h1 className="font-heading text-3xl font-semibold tracking-tight">Pulse</h1>
        <HeaderIncome
          incomeCategories={incomeCategories}
          targets={targets}
          currentMonth={thisMonth}
        />
      </header>

      <div className="mb-8">
        <RangeSelector active={preset} basePath="/" />
      </div>

      <div className="mb-10 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <HeroKpi emoji="💸" label="Spent" value={fmt(expenseTotal)} sub={rangeText} />
        <HeroKpi emoji="🌱" label="Saved" value={fmt(savingsTotal)} sub={rangeText} positive />
        <HeroKpi
          emoji="📊"
          label="Savings rate"
          value={savingsRate === null ? "n/a" : `${Math.round(savingsRate * 100)}%`}
          sub={rangeText}
        />
      </div>

      <SectionHeading>Expenses · {rangeText.toLowerCase()}</SectionHeading>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {expenses.map((c) => {
          const agg = aggregateById.get(c.id);
          return (
            <CategoryCard
              key={c.id}
              category={c}
              total={agg?.total ?? 0}
              denominator={agg?.denominator ?? 0}
              perMonthTarget={resolveTargetForMonth(c.id, range.ymEnd, targets)}
              transactions={transactions}
            />
          );
        })}
        <AddCategoryTile kind="expense" />
      </div>

      <div className="mt-8">
        <SectionHeading>Savings · {rangeText.toLowerCase()}</SectionHeading>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {savings.map((c) => {
            const agg = aggregateById.get(c.id);
            return (
              <CategoryCard
                key={c.id}
                category={c}
                total={agg?.total ?? 0}
                denominator={agg?.denominator ?? 0}
                perMonthTarget={resolveTargetForMonth(c.id, range.ymEnd, targets)}
                transactions={transactions}
              />
            );
          })}
          <AddCategoryTile kind="savings" />
        </div>
      </div>

      <AddMenu categories={categories} transactions={transactions} />
    </div>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      {children}
    </h2>
  );
}

function HeroKpi({
  emoji,
  label,
  value,
  sub,
  positive,
}: {
  emoji: string;
  label: string;
  value: string;
  sub?: string;
  positive?: boolean;
}) {
  return (
    <div className="rounded-2xl bg-card p-5 ring-1 ring-border">
      <div className="mb-2 text-2xl">{emoji}</div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p
        className={
          "mt-1 font-heading text-3xl font-semibold tabular-nums " +
          (positive ? "text-emerald-700 dark:text-emerald-400" : "")
        }
      >
        {value}
      </p>
      {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}
