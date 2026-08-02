import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CategoryDetailBody } from "@/components/budget/category/CategoryDetailBody";
import { CategorySwitcher } from "@/components/budget/category/CategorySwitcher";
import { RangeSelector } from "@/components/budget/shared/RangeSelector";
import { BackLink } from "@/components/shell/BackLink";
import {
  isRangePreset,
  rangeLabel,
  resolveRange,
} from "@/lib/budget";
import type { RangePreset } from "@/types/range";
import { getSession, requireHouseholdId } from "@/lib/auth/session";
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
  // Metadata resolves in parallel with AppLayout's session gate. For a
  // signed-out/denied session the layout renders the redirect / PrivateAppScreen
  // (story 6's no-residue flow); this must not throw past that gate via its own
  // `requireHouseholdId`, so short-circuit to a neutral title without touching
  // household data.
  const session = await getSession();
  if (session.status !== "active") return { title: "Category" };
  await ensureSeeded(session.membership.householdId);
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
  await ensureSeeded(await requireHouseholdId());
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
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <BackLink href="/categories" label="Categories" />
        <CategorySwitcher categories={categories} currentId={category.id} rangePreset={preset} />
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
