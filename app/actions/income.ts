"use server";

import { revalidatePath } from "next/cache";

import { currentMonthKey, nextMonth } from "@/lib/budget";
import { createCategory, updateCategory } from "@/lib/repositories/categories";
import {
  createCategoryTarget,
  upsertCategoryTarget,
} from "@/lib/repositories/categoryTargets";

function parseYearly(raw: FormDataEntryValue | null): number {
  // Accept user typed strings like "$90,000" — strip everything but digits, dot, minus.
  const s = typeof raw === "string" ? raw.replace(/[^0-9.\-]/g, "") : "";
  const n = Number(s);
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error("Yearly amount must be a positive number");
  }
  return n;
}

function requireString(raw: FormDataEntryValue | null, field: string): string {
  if (typeof raw !== "string" || raw.trim() === "") {
    throw new Error(`Missing required field: ${field}`);
  }
  return raw.trim();
}

/**
 * Writes a new effective-dated baseline for an income source. The UI enters a
 * yearly value; persistence stores monthly (yearly ÷ 12) to keep the storage
 * shape uniform across kinds. `applyThisMonth` toggles between effective-from
 * = current month vs. next month (the default).
 */
export async function updateIncomeBaselineAction(formData: FormData): Promise<void> {
  const categoryId = requireString(formData.get("categoryId"), "categoryId");
  const yearly = parseYearly(formData.get("yearly"));
  const applyThisMonth = formData.get("applyThisMonth") === "on";

  const thisMonth = currentMonthKey();
  const effectiveFrom = applyThisMonth ? thisMonth : nextMonth(thisMonth);
  const monthly = yearly / 12;

  await upsertCategoryTarget({ categoryId, monthly, effectiveFrom });
  revalidatePath("/");
}

/**
 * Adds a brand-new income source: a `kind: "income"` category and an initial
 * baseline target row. `activeFrom` defaults to the current month so the
 * source contributes to today's annualized header value immediately.
 */
export async function createIncomeSourceAction(formData: FormData): Promise<void> {
  const name = requireString(formData.get("name"), "name");
  const emoji = (formData.get("emoji") as string | null)?.trim() || "💼";
  const yearly = parseYearly(formData.get("yearly"));
  const activeFrom = currentMonthKey();

  const category = await createCategory({
    name,
    emoji,
    kind: "income",
    activeFrom,
  });

  await createCategoryTarget({
    categoryId: category.id,
    monthly: yearly / 12,
    effectiveFrom: activeFrom,
  });

  revalidatePath("/");
}

/**
 * Ends an income source by setting `activeUntil` to the current month — the
 * source still counts for the current month's pro-rated baseline but is
 * excluded from next month forward.
 */
export async function endIncomeSourceAction(formData: FormData): Promise<void> {
  const categoryId = requireString(formData.get("categoryId"), "categoryId");
  await updateCategory(categoryId, { activeUntil: currentMonthKey() });
  revalidatePath("/");
}
