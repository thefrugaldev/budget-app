import type { Metadata } from "next";

import { HeaderIncome } from "@/components/budget/income/HeaderIncome";
import { GrowthColumns } from "@/components/budget/pulse/GrowthColumns";
import { NeedsAttention } from "@/components/budget/pulse/NeedsAttention";
import { RangeSelector } from "@/components/budget/shared/RangeSelector";
import {
  aggregateRange,
  computeIncomeForRange,
  computeSavingsRate,
  currentMonthKey,
  fmt,
  isCategoryActiveInRange,
  isRangePreset,
  monthProgress,
  monthlyTrend,
  planTargetForMonth,
  rangeLabel,
  resolveRange,
  savingsRateToneClass,
  selectAttention,
} from "@/lib/budget";
import { cn } from "@/lib/utils";
import type { RangePreset } from "@/types/range";
import { requireHouseholdId } from "@/lib/auth/session";
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
  await ensureSeeded(await requireHouseholdId());
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
  const rangeLower = rangeText.toLowerCase();
  const ratePct = savingsRate === null ? null : Math.round(savingsRate * 100);

  // The signature reads a fixed trailing window, independent of the range
  // selector, so it always tells the "over time" story. The plan line is the
  // current month's total caps + goals.
  const trend = monthlyTrend(transactions, categories, 6, now);
  const plan = planTargetForMonth(categories, targets, thisMonth);

  // Overview, not ledger (story 17): Pulse surfaces only the exception rows for
  // the active range — over-cap expenses, savings behind / withdrawn / (closed
  // windows) not started, met goals — via the selector, capped with an overflow
  // count. The full per-category ledger lives on /categories. Pace-awareness
  // (#178): pass month-progress only when the range *is* the in-progress
  // current month, so a not-yet-funded goal reads as pending early rather than
  // as a missed exception; any wider/closed window keeps $0 as genuinely missed.
  const attention = selectAttention(
    inRange,
    aggregates,
    undefined,
    preset === "this-month" ? { pace: { monthProgress: monthProgress(now) } } : undefined,
  );

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-10 pb-[calc(10rem+env(safe-area-inset-bottom))] md:pb-28">
      {/* Thesis hero (#80 "Harvest+"): lead with the money and the momentum —
          the amount kept and the savings rate — instead of a bare page title
          and the templated 3-up KPI strip. Spent/Saved subtotals fold into the
          section headings below; the rate lives in the aside. */}
      <header className="mb-8 flex flex-wrap items-start justify-between gap-x-8 gap-y-5">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Pulse · {rangeText}
          </p>
          {/* Pace-resilient lead (#178 stories 1/2): never open with a zero
              verdict. A month with contributions leads with what was kept/drawn;
              an untouched month leads with the income that's landed (or a neutral
              "getting started"), so the headline is useful on day 2 and day 28
              alike. `text-balance` keeps the display-face line from breaking
              awkwardly; the nbsp binds each figure to its verb so a number never
              orphans to a new line. */}
          <h1 className="mt-3 text-balance font-heading text-hero font-semibold tracking-tight">
            {savingsTotal > 0 ? (
              <>
                You kept{" "}
                <span className="text-signal-good-foreground tabular-nums">
                  {fmt(savingsTotal)}
                </span>{" "}
                {rangeLower}.
              </>
            ) : savingsTotal < 0 ? (
              <>
                You drew{" "}
                <span className="text-signal-bad-foreground tabular-nums">
                  {fmt(Math.abs(savingsTotal))}
                </span>{" "}
                from savings {rangeLower}.
              </>
            ) : incomeForRange > 0 ? (
              <>
                You&rsquo;ve brought in{" "}
                <span className="tabular-nums">{fmt(incomeForRange)}</span> {rangeLower}.
              </>
            ) : (
              <>Your {rangeLower} is just getting started.</>
            )}
          </h1>
          <p className="mt-3 text-base text-muted-foreground">
            {ratePct === null ? (
              <>Add an income source to see your savings rate.</>
            ) : savingsTotal !== 0 ? (
              <>
                That&rsquo;s {ratePct}% of the{" "}
                <span className="tabular-nums">{fmt(incomeForRange)}</span> you brought in
                {expenseTotal > 0 ? (
                  <>
                    , with{" "}
                    <span className="tabular-nums">{fmt(expenseTotal)}</span> spent.
                  </>
                ) : (
                  "."
                )}
              </>
            ) : expenseTotal > 0 ? (
              <>
                You&rsquo;ve spent{" "}
                <span className="tabular-nums">{fmt(expenseTotal)}</span> {rangeLower}.
              </>
            ) : (
              <>Nothing tracked yet {rangeLower}.</>
            )}
          </p>
        </div>
        <div className="flex flex-col items-start gap-3 sm:items-end">
          {ratePct !== null && (
            <div className="sm:text-right">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Savings rate
              </p>
              {/* Colour tracks the value (#178 story 9): neutral at 0, good
                  only when healthy, bad when net-negative — 0% is never green. */}
              <p
                className={cn(
                  "mt-1 font-heading text-display font-semibold tabular-nums",
                  savingsRateToneClass(savingsRate),
                )}
              >
                {ratePct}%
              </p>
            </div>
          )}
          <HeaderIncome
            incomeCategories={incomeCategories}
            targets={targets}
            currentMonth={thisMonth}
          />
        </div>
      </header>

      {/* Directly under the hero so it visibly governs the range-scoped content
          it sits above — the hero figures and "Needs attention" (#178 story
          12). The trend chart below stays a fixed trailing-6-month backdrop,
          independent of this selector. */}
      <div className="mb-8">
        <RangeSelector active={preset} basePath="/" />
      </div>

      <div className="mb-8">
        <GrowthColumns data={trend} plan={plan} />
      </div>

      <NeedsAttention result={attention} />
    </div>
  );
}
