import { CategoryCard } from "@/components/budget/CategoryCard";
import { RangeSelector } from "@/components/budget/RangeSelector";
import {
  aggregateRange,
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
  const expenseTotal = expenses.reduce(
    (s, c) => s + (aggregateById.get(c.id)?.total ?? 0),
    0,
  );
  const savingsTotal = savings.reduce(
    (s, c) => s + (aggregateById.get(c.id)?.total ?? 0),
    0,
  );
  const monthsIn = now.getUTCMonth() + now.getUTCDate() / 30;
  const rangeText = rangeLabel(preset);

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-10 pb-28">
      <header className="mb-6">
        <h1 className="font-heading text-3xl font-semibold tracking-tight">Pulse</h1>
      </header>

      <div className="mb-8">
        <RangeSelector active={preset} basePath="/" />
      </div>

      <div className="mb-10 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <HeroKpi emoji="💸" label="Spent" value={fmt(expenseTotal)} sub={rangeText} />
        <HeroKpi emoji="🌱" label="Saved" value={fmt(savingsTotal)} sub={rangeText} positive />
        <HeroKpi emoji="📅" label="Months in" value={monthsIn.toFixed(1)} sub="of 12" />
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

      <button
        className="fixed bottom-8 right-8 z-10 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-base font-medium text-primary-foreground shadow-lg ring-1 ring-black/10 hover:bg-primary/80"
        aria-label="Add transaction"
      >
        <span className="text-xl leading-none">+</span>
        <span>Add</span>
      </button>
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
