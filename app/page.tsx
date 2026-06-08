import { AddMenu } from "@/components/budget/AddMenu";
import { CategoryCard } from "@/components/budget/CategoryCard";
import { HeaderIncome } from "@/components/budget/HeaderIncome";
import { RangeSelector } from "@/components/budget/RangeSelector";
import {
  aggregateRange,
  computeIncomeForRange,
  computeSavingsRate,
  currentMonthKey,
  fmt,
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

  const expenses = categories.filter((c) => c.kind === "expense");
  const savings = categories.filter((c) => c.kind === "savings");
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
    <div className="mx-auto w-full max-w-5xl px-6 py-10 pb-28">
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
