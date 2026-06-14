import type { Metadata } from "next";

import { AddIncomeSourceLauncher } from "@/components/budget/AddIncomeSourceLauncher";
import {
  currentMonthKey,
  currentMonthlyBaseline,
  fmt,
  isCategoryActiveForMonth,
} from "@/lib/budget";
import { ensureSeeded } from "@/lib/db/seed";
import { listCategories } from "@/lib/repositories/categories";
import { listCategoryTargets } from "@/lib/repositories/categoryTargets";

export const metadata: Metadata = {
  title: "Income",
};

/**
 * `/income` page scaffold (chunk 3 of #39). Renders inside `AppShell` like
 * every other route, reads the same `(categories, targets)` data the Pulse
 * header reads, and surfaces a stub list of source names. The Pulse header
 * pencil still owns editing until chunk 7 retires the modal — this page
 * exists to be a real navigation destination (story 22) and to host the
 * card UI and lifecycle actions that land in chunks 4–6.
 */
export default async function IncomePage() {
  await ensureSeeded();
  const [categories, targets] = await Promise.all([
    listCategories(),
    listCategoryTargets(),
  ]);

  const now = new Date();
  const thisMonth = currentMonthKey(now);
  const incomeCategories = categories.filter((c) => c.kind === "income");
  const activeIncome = incomeCategories.filter((c) =>
    isCategoryActiveForMonth(c, thisMonth),
  );

  const totalMonthly = currentMonthlyBaseline(activeIncome, targets, thisMonth);
  const totalYearly = totalMonthly * 12;

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-10 pb-[calc(9rem+env(safe-area-inset-bottom))] md:pb-28">
      <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-semibold tracking-tight">
            Income
          </h1>
          {activeIncome.length > 0 && (
            <p className="mt-2 text-sm text-muted-foreground">
              <span className="font-medium text-foreground tabular-nums">
                {fmt(totalYearly)}
                <span className="ml-0.5 text-xs text-muted-foreground">/yr</span>
              </span>
              {" · "}
              <span className="tabular-nums">
                {fmt(totalMonthly)}
                <span className="ml-0.5 text-xs">/mo</span>
              </span>
              {" current total"}
            </p>
          )}
        </div>
        {activeIncome.length > 0 && <AddIncomeSourceLauncher />}
      </header>

      {activeIncome.length === 0 ? (
        <EmptyState />
      ) : (
        <ul className="space-y-2">
          {activeIncome.map((c) => (
            <li
              key={c.id}
              className="flex items-center gap-3 rounded-xl bg-card px-4 py-3 ring-1 ring-border"
            >
              <span aria-hidden className="text-xl">
                {c.emoji}
              </span>
              <span className="font-medium">{c.name}</span>
            </li>
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
