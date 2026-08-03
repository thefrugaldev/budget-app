import type { Metadata } from "next";

import { CategoryLedgerList } from "@/components/budget/category/CategoryLedgerList";
import { AddMenu } from "@/components/budget/shared/AddMenu";
import { RangeSelector } from "@/components/budget/shared/RangeSelector";
import { requireHouseholdId } from "@/lib/auth/session";
import { isRangePreset, rangeLabel, resolveRange } from "@/lib/budget";
import { ensureSeeded } from "@/lib/db/seed";
import { listCategories } from "@/lib/repositories/categories";
import { listCategoryTargets } from "@/lib/repositories/category-targets";
import { listAllTransactions } from "@/lib/repositories/transactions";
import type { RangePreset } from "@/types/range";

export const metadata: Metadata = {
  title: "Categories",
};

/**
 * The reinstated Categories index (issue #166 chunk 3) — the working ledger for
 * per-category budgeting, split out of Pulse. A recency-sorted list of the
 * household's expense/savings categories with a fulfillment chip and last-active
 * stamp per row. The `?range=` scope mirrors the category detail + Pulse
 * surfaces (server `RangeSelector`, `this-month` default). The Add menu mounts
 * here (desktop entry surface, story 11) and self-hides for viewers.
 */
export default async function CategoriesPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string | string[] }>;
}) {
  const { range: rangeParam } = await searchParams;
  await ensureSeeded(await requireHouseholdId());
  const [categories, targets, transactions] = await Promise.all([
    listCategories(),
    listCategoryTargets(),
    listAllTransactions(),
  ]);

  const raw = Array.isArray(rangeParam) ? rangeParam[0] : rangeParam;
  const preset: RangePreset = isRangePreset(raw) ? raw : "this-month";
  const now = new Date();
  const range = resolveRange(preset, now);
  const rangeText = rangeLabel(preset);

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-8 pb-[calc(6rem+env(safe-area-inset-bottom))] md:pb-28">
      <header className="mb-6">
        <h1 className="font-heading text-display font-semibold">Categories</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Most recently active first · {rangeText.toLowerCase()}.
        </p>
        <div className="mt-4">
          <RangeSelector active={preset} basePath="/categories" />
        </div>
      </header>

      <CategoryLedgerList
        categories={categories}
        transactions={transactions}
        targets={targets}
        range={range}
        now={now}
      />

      <AddMenu categories={categories} transactions={transactions} />
    </div>
  );
}
