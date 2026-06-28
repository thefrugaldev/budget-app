import type { Metadata } from "next";

import { AddIncomeSourceLauncher } from "@/components/budget/income/AddIncomeSourceLauncher";
import { IncomeSourceCard } from "@/components/budget/income/IncomeSourceCard";
import {
  computeIncomeForRange,
  currentMonthKey,
  currentMonthlyBaseline,
  fmt,
} from "@/lib/budget";
import { oneTimeReceiptSummary } from "@/lib/income";
import type { OneTimeReceiptSummary } from "@/types/budget";
import { ensureSeeded } from "@/lib/db/seed";
import { listCategories } from "@/lib/repositories/categories";
import { listCategoryTargets } from "@/lib/repositories/categoryTargets";
import { listAllTransactions } from "@/lib/repositories/transactions";

export const metadata: Metadata = {
  title: "Income",
};

/**
 * `/income` page (chunks 3–4 of #39). Renders inside `AppShell` like every
 * other route, reads the same `(categories, targets)` data the Pulse header
 * reads, and surfaces each income source as a read-mode card with a status
 * pill and one-sentence baseline summary. Ended sources stay in the list so
 * chunk 6's Reopen affordance has a row to attach to. The Pulse header
 * pencil still owns editing until chunk 7 retires the modal.
 */
export default async function IncomePage() {
  await ensureSeeded();
  const [categories, targets, transactions] = await Promise.all([
    listCategories(),
    listCategoryTargets(),
    listAllTransactions(),
  ]);

  const thisMonth = currentMonthKey();
  const thisYear = thisMonth.slice(0, 4);
  const incomeCategories = categories.filter((c) => c.kind === "income");

  // Bucket transaction counts by categoryId in one pass — the ⋯ menu needs
  // it to gate hard-delete (zero transactions). Cheaper than N round-trips
  // to `countTransactionsForCategory` at this app's scale.
  const txCountByCategory = new Map<string, number>();
  for (const t of transactions) {
    txCountByCategory.set(t.categoryId, (txCountByCategory.get(t.categoryId) ?? 0) + 1);
  }

  // One-time sources are measured against their receipts, not a baseline, so
  // their card needs YTD-received + last-receipt — computed here on the server
  // (chunk 5). Recurring sources skip this; their card reads from `targets`.
  const oneTimeSummaryByCategory = new Map<string, OneTimeReceiptSummary>();
  for (const c of incomeCategories) {
    if (c.incomeFrequency === "one-time") {
      oneTimeSummaryByCategory.set(
        c.id,
        oneTimeReceiptSummary(transactions, c.id, thisYear),
      );
    }
  }

  // currentMonthlyBaseline already filters to sources active *this* month,
  // so ended/future sources don't inflate the headline figure.
  const totalMonthly = currentMonthlyBaseline(
    incomeCategories,
    targets,
    thisMonth,
  );
  const totalYearly = totalMonthly * 12;

  // YTD income to date (story 2): elapsed baseline this year + irregular
  // income transactions (bonuses, RSU vests, side-gig). Same helper the Pulse
  // savings-rate KPI uses, so the two surfaces can't drift.
  const ytdIncome = computeIncomeForRange(
    incomeCategories,
    targets,
    transactions,
    `${thisMonth.slice(0, 4)}-01`,
    thisMonth,
  );

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-10 pb-[calc(9rem+env(safe-area-inset-bottom))] md:pb-28">
      <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-semibold tracking-tight">
            Income
          </h1>
          {incomeCategories.length > 0 && (
            <p className="mt-2 text-sm text-muted-foreground">
              {totalMonthly > 0 && (
                <>
                  <span className="font-medium text-foreground tabular-nums">
                    {fmt(totalYearly)}
                    <span className="ml-0.5 text-xs text-muted-foreground">
                      /yr
                    </span>
                  </span>
                  {" · "}
                  <span className="tabular-nums">
                    {fmt(totalMonthly)}
                    <span className="ml-0.5 text-xs">/mo</span>
                  </span>
                  {" current total · "}
                </>
              )}
              <span className="tabular-nums">{fmt(ytdIncome)}</span>
              {" YTD"}
            </p>
          )}
        </div>
        {incomeCategories.length > 0 && <AddIncomeSourceLauncher />}
      </header>

      {incomeCategories.length === 0 ? (
        <EmptyState />
      ) : (
        <ul className="space-y-3">
          {incomeCategories.map((c) => (
            <IncomeSourceCard
              key={c.id}
              source={c}
              allSources={incomeCategories}
              targets={targets}
              currentMonth={thisMonth}
              txCount={txCountByCategory.get(c.id) ?? 0}
              oneTimeSummary={oneTimeSummaryByCategory.get(c.id)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl bg-card p-8 text-center ring-1 ring-border sm:p-12">
      <div aria-hidden className="mb-4 text-5xl">
        💼
      </div>
      <h2 className="font-heading text-xl font-semibold tracking-tight">
        No income sources yet
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Add your first source to start tracking baselines and growth.
      </p>
      <div className="mt-6 flex justify-center">
        <AddIncomeSourceLauncher variant="prominent" />
      </div>
    </div>
  );
}
