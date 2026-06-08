import Link from "next/link";
import { notFound } from "next/navigation";

import { MonthBarChart } from "@/components/budget/MonthBarChart";
import { QuickAddForm } from "@/components/budget/QuickAddForm";
import { ThresholdMeter } from "@/components/budget/ThresholdMeter";
import {
  currentMonthKey,
  dayLabel,
  fmt,
  fmtExact,
  monthlyTotalsLastN,
  monthTotalsByCategory,
  resolveTargetForMonth,
  thresholdColor,
  thresholdFor,
} from "@/lib/budget";
import { ensureSeeded } from "@/lib/db/seed";
import { listCategories } from "@/lib/repositories/categories";
import { listCategoryTargets } from "@/lib/repositories/categoryTargets";
import { listAllTransactions } from "@/lib/repositories/transactions";

export default async function CategoryDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await ensureSeeded();
  const [categories, targets, transactions] = await Promise.all([
    listCategories(),
    listCategoryTargets(),
    listAllTransactions(),
  ]);

  const category = categories.find((c) => c.id === id);
  if (!category) notFound();

  const now = new Date();
  const monthKey = currentMonthKey(now);
  const thisMonth = monthTotalsByCategory(transactions, categories, monthKey).get(category.id) ?? 0;
  const target = resolveTargetForMonth(category.id, monthKey, targets);
  const state = thresholdFor(category.kind, target, thisMonth);
  const col = thresholdColor(category.kind, state);
  const pct = target === 0 ? 0 : thisMonth / target;
  const isSavings = category.kind === "savings";
  const isNegative = thisMonth < 0;
  const showPlus = isSavings && thisMonth > 0;
  const trend = monthlyTotalsLastN(transactions, category.id, 6, now);

  const txns = transactions.filter((t) => t.categoryId === category.id).sort((a, b) =>
    b.date.localeCompare(a.date),
  );

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-8 pb-20">
      <Link href="/" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        ← Back to budget
      </Link>

      <div className="mt-3 grid gap-6 lg:grid-cols-[340px_1fr]">
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
                  {isSavings ? "Goal" : "Cap"} · {fmt(target)}/mo
                </p>
              </div>
            </div>
            <p className={"font-heading text-3xl font-semibold tabular-nums " + col.text}>
              {isNegative && <span aria-label="net negative" className="mr-1">↓</span>}
              {showPlus ? "+" : ""}
              {fmtExact(thisMonth)}
            </p>
            <p className="text-xs text-muted-foreground">
              this month · {Math.round(pct * 100)}% of {isSavings ? "goal" : "cap"}
            </p>
            <ThresholdMeter kind={category.kind} target={target} amount={thisMonth} className="mt-2" height="h-2" />
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
              monthly={target}
              kind={category.kind}
              highlightYm={monthKey}
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
                defaultValue={target}
                className="rounded-md bg-background px-2 py-1.5 ring-1 ring-border outline-none focus:ring-ring"
              />
            </div>
          </details>
        </aside>

        <section>
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="font-heading text-lg font-medium">{txns.length} transactions</h2>
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
                      {isSavings && t.amount > 0 ? "+" : ""}
                      {fmtExact(t.amount)}
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
                No transactions yet for this category.
              </li>
            )}
          </ul>
        </section>
      </div>
    </div>
  );
}
