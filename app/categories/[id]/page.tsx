import Link from "next/link";
import { notFound } from "next/navigation";

import { CategoryDetailBody } from "@/components/budget/CategoryDetailBody";
import { RangeSelector } from "@/components/budget/RangeSelector";
import {
  isRangePreset,
  rangeLabel,
  resolveRange,
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

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-8 pb-20">
      <Link
        href="/"
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        ← Back to budget
      </Link>

      <div className="mt-4 mb-6">
        <RangeSelector active={preset} basePath={`/categories/${category.id}`} />
      </div>

      <CategoryDetailBody
        category={category}
        categories={categories}
        transactions={transactions}
        targets={targets}
        range={range}
        rangeText={rangeText}
        now={now}
      />
    </div>
  );
}
