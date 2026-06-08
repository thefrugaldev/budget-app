"use server";

import { revalidatePath } from "next/cache";

import { currentMonthKey, nextMonth } from "@/lib/budget";
import {
  createCategory,
  getCategoryById,
  updateCategory,
} from "@/lib/repositories/categories";
import {
  createCategoryTarget,
  upsertCategoryTarget,
} from "@/lib/repositories/categoryTargets";

import { parseYearly } from "./income-parsers";
import type { IncomeActionState } from "./income-state";

function requireString(raw: FormDataEntryValue | null, field: string): string {
  if (typeof raw !== "string" || raw.trim() === "") {
    throw new Error(`Missing required field: ${field}`);
  }
  return raw.trim();
}

async function assertIncomeCategory(categoryId: string): Promise<void> {
  const cat = await getCategoryById(categoryId);
  if (!cat) throw new Error("Category not found");
  if (cat.kind !== "income") {
    throw new Error("Action only permitted on income categories");
  }
}

function success(prev: IncomeActionState): IncomeActionState {
  return { error: null, ok: prev.ok + 1 };
}

function failure(prev: IncomeActionState, err: unknown): IncomeActionState {
  const message = err instanceof Error ? err.message : "Something went wrong";
  return { error: message, ok: prev.ok };
}

/**
 * Writes a new effective-dated baseline for an income source. The UI enters a
 * yearly value; persistence stores monthly (yearly ÷ 12) to keep the storage
 * shape uniform across kinds. `applyThisMonth` toggles between effective-from
 * = current month vs. next month (the default).
 */
export async function updateIncomeBaselineAction(
  prev: IncomeActionState,
  formData: FormData,
): Promise<IncomeActionState> {
  try {
    const categoryId = requireString(formData.get("categoryId"), "categoryId");
    await assertIncomeCategory(categoryId);
    const yearly = parseYearly(formData.get("yearly"));
    const applyThisMonth = formData.get("applyThisMonth") === "on";

    const thisMonth = currentMonthKey();
    const effectiveFrom = applyThisMonth ? thisMonth : nextMonth(thisMonth);

    await upsertCategoryTarget({
      categoryId,
      monthly: yearly / 12,
      effectiveFrom,
    });
    revalidatePath("/");
    return success(prev);
  } catch (err) {
    return failure(prev, err);
  }
}

/**
 * Adds a brand-new income source: a `kind: "income"` category and an initial
 * baseline target row. `activeFrom` defaults to the current month so the
 * source contributes to today's annualized header value immediately.
 */
export async function createIncomeSourceAction(
  prev: IncomeActionState,
  formData: FormData,
): Promise<IncomeActionState> {
  try {
    const name = requireString(formData.get("name"), "name");
    const emoji = (formData.get("emoji") as string | null)?.trim() || "💰";
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
    return success(prev);
  } catch (err) {
    return failure(prev, err);
  }
}

/**
 * Ends an income source by setting `activeUntil` to the current month — the
 * source still counts for the current month's pro-rated baseline but is
 * excluded from next month forward.
 */
export async function endIncomeSourceAction(
  prev: IncomeActionState,
  formData: FormData,
): Promise<IncomeActionState> {
  try {
    const categoryId = requireString(formData.get("categoryId"), "categoryId");
    await assertIncomeCategory(categoryId);
    await updateCategory(categoryId, { activeUntil: currentMonthKey() });
    revalidatePath("/");
    return success(prev);
  } catch (err) {
    return failure(prev, err);
  }
}
