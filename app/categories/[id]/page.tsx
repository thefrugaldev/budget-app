import Link from "next/link";
import { notFound } from "next/navigation";

import { MonthBarChart, type MonthBarDatum } from "@/components/budget/MonthBarChart";
import { QuickAddForm } from "@/components/budget/QuickAddForm";
import { RangeSelector } from "@/components/budget/RangeSelector";
import { SignedAmount } from "@/components/budget/SignedAmount";
import { ThresholdMeter } from "@/components/budget/ThresholdMeter";
import {
  aggregateRange,
  currentMonthKey,
  dayLabel,
  fmt,
  isRangePreset,
  monthlyTotalsLastN,
  rangeLabel,
  resolveRange,
  resolveTargetForMonth,
  thresholdColor,
  thresholdFor,
  type RangePreset,
} from "@/lib/budget";
import { ensureSeeded } from "@/lib/db/seed";
import { listCategories } from "@/lib/repositories/categories";
import { listCategoryTargets } from "@/lib/repositories/categoryTargets";
import { listAllTransactions } from "@/lib/repositories/transactions";

export default async function CategoryDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ range?: string | string[] }>;
}) {
  const [{ id }, { range: rangeParam }] = await Promise.all([params, searchParams]);
  await ensureSeeded();
  const [categories, targets, transactions] = await Promise.all([
    listCategories(),
    listCategoryTargets(),
    listAllTransactions(),
  ]);

  const category = categories.find((c) => c.id === id);
  if (!category) notFound();

  const raw = Array.isArray(rangeParam) ? rangeParam[0] : rangeParam;
  const preset: RangePreset = isRangePreset(raw) ? raw : "this-month";
  const now = new Date();
  const range = resolveRange(preset, now);
  const rangeText = rangeLabel(preset);

  const [agg] = aggregateRange(
    transactions,
    [category],
    range.ymStart,
    range.ymEnd,
    targets,
  );
  const total = agg.total;
  const denominator = agg.denominator;
  const perMonthTarget = resolveTargetForMonth(category.id, range.ymEnd, targets);
  const state = thresholdFor(category.kind, denominator, total);
  const col = thresholdColor(category.kind, state);
  const pct = denominator === 0 ? 0 : total / denominator;
  const isSavings = category.kind === "savings";
  const isNegative = total < 0;

  const trend: MonthBarDatum[] = monthlyTotalsLastN(transactions, category.id, 6, now).map(
    (m) => ({
      ym: m.ym,
      total: m.total,
      target: resolveTargetForMonth(category.id, m.ym, targets),
    }),
  );

  const txns = transactions
    .filter((t) => {
      if (t.categoryId !== category.id) return false;
      const ym = t.date.slice(0, 7);
      return ym >= range.ymStart && ym <= range.ymEnd;
    })
    .sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-8 pb-20">
      <Link href="/" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        ← Back to budget
      </Link>

      <div className="mt-4 mb-6">
        <RangeSelector active={preset} basePath={`/categories/${category.id}`} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
        <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          <div
            className={
              "relative overflow-hidden rounded-2xl bg-card p-5 ring-1 " +
              (isSavings ? "ring-emerald-200 dark:ring-emerald-900" : "ring-border")
            }
          >
            {isNegative && (
              <span aria-hidden className="absolute inset-y-0 left-0 w-1 bg-rose-500" />
            )}
            <div className="mb-3 flex items-center gap-3">
              <div className="grid size-12 place-items-center rounded-xl bg-muted text-3xl">
                {category.emoji}
              </div>
              <div>
                <h1 className="font-heading text-lg font-semibold leading-tight">{category.name}</h1>
                <p className="text-xs text-muted-foreground">
                  {isSavings ? "Goal" : "Cap"} · {fmt(perMonthTarget)}/mo
                </p>
              </div>
            </div>
            <p className={"font-heading text-3xl font-semibold tabular-nums " + col.text}>
              <SignedAmount kind={category.kind} amount={total} />
            </p>
            <p className="text-xs text-muted-foreground">
              {rangeText.toLowerCase()} · {Math.round(pct * 100)}% of {isSavings ? "goal" : "cap"}
            </p>
            <ThresholdMeter kind={category.kind} target={denominator} amount={total} className="mt-2" height="h-2" />
          </div>

          <div className="rounded-2xl bg-card p-4 ring-1 ring-border">
            <QuickAddForm category={category} />
          </div>

          <div className="rounded-2xl bg-card p-4 ring-1 ring-border">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              6-month trend
            </h2>
            <MonthBarChart
              data={trend}
              kind={category.kind}
              highlightYm={currentMonthKey(now)}
              width={300}
              height={120}
            />
          </div>

          <details className="rounded-2xl bg-card p-4 text-sm ring-1 ring-border">
            <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Threshold
            </summary>
            <div className="mt-3 grid grid-cols-[110px_1fr] items-center gap-y-2">
              <label htmlFor="monthly">Monthly</label>
              <input
                id="monthly"
                defaultValue={perMonthTarget}
                className="rounded-md bg-background px-2 py-1.5 ring-1 ring-border outline-none focus:ring-ring"
              />
            </div>
          </details>
        </aside>

        <section>
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="font-heading text-lg font-medium">
              {txns.length} transactions · {rangeText.toLowerCase()}
            </h2>
            <input
              placeholder="Filter…"
              className="rounded-md bg-card px-3 py-1.5 text-sm ring-1 ring-border outline-none focus:ring-ring"
            />
          </div>
          <ul className="divide-y divide-border rounded-2xl bg-card ring-1 ring-border">
            {txns.map((t) => (
              <li key={t.id} className="flex items-start gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="truncate">
                      <span className="font-medium">{t.vendor ?? "—"}</span>
                      <span className="ml-2 text-xs text-muted-foreground">{dayLabel(t.date, now)}</span>
                    </p>
                    <span
                      className={
                        "shrink-0 tabular-nums " +
                        (isSavings && t.amount > 0 ? "text-emerald-700 dark:text-emerald-400" : "")
                      }
                    >
                      <SignedAmount kind={category.kind} amount={t.amount} marker={false} />
                    </span>
                  </div>
                  {t.note && (
                    <p className="mt-0.5 text-xs text-muted-foreground">{t.note}</p>
                  )}
                </div>
              </li>
            ))}
            {txns.length === 0 && (
              <li className="px-4 py-6 text-center text-sm text-muted-foreground">
                No transactions in this range.
              </li>
            )}
          </ul>
        </section>
      </div>
    </div>
  );
}
