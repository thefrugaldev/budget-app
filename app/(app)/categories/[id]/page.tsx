import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CategoryDetailBody } from "@/components/budget/category/CategoryDetailBody";
import { RangeSelector } from "@/components/budget/shared/RangeSelector";
import { BackLink } from "@/components/shell/BackLink";
import {
  isRangePreset,
  rangeLabel,
  resolveRange,
} from "@/lib/budget";
import type { RangePreset } from "@/types/range";
import { ensureSeeded } from "@/lib/db/seed";
import { listCategories } from "@/lib/repositories/categories";
import { listCategoryTargets } from "@/lib/repositories/categoryTargets";
import { listAllTransactions } from "@/lib/repositories/transactions";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  await ensureSeeded();
  const categories = await listCategories();
  const category = categories.find((c) => c.id === id);
  return { title: category?.name ?? "Category" };
}

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
      <div className="mb-4">
        <BackLink href="/" label="Pulse" />
      </div>
      <div className="mb-6">
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
