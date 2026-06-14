"use server";

import { revalidatePath } from "next/cache";

import { currentMonthKey, nextMonth } from "@/lib/budget";
import {
  createCategory,
  getCategoryById,
} from "@/lib/repositories/categories";
import {
  createCategoryTarget,
  deleteCategoryTarget,
  upsertCategoryTarget,
} from "@/lib/repositories/categoryTargets";

import {
  parseCancelScheduledBaselineInput,
  parseYearly,
} from "./income-parsers";
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

// `endIncomeSourceAction` was here. Removed during chunk 9 cleanup: the
// detail-page panel and the header income dialog now both go through
// `endCategoryAction` in `app/actions/categories.ts`, so there's one end
// path regardless of which surface the user clicks. The income-only
// `assertIncomeCategory` guard it had was incidental — the header pencil
// only ever lists income categories anyway.

/**
 * Deletes a future-effective `CategoryTarget` row keyed by
 * `(categoryId, effectiveFrom)` — the "I queued a raise next month and
 * changed my mind" path. Rejects if `effectiveFrom <= currentMonth`, since
 * the current (or past) baseline isn't a "scheduled change" and removing it
 * would silently strand the source without a baseline for that month.
 *
 * Idempotent at the action layer: if the row is already gone (concurrent
 * cancel, double-click, stale UI) the underlying `deleteOne` no-ops and
 * the action still returns success. "User got what they wanted" wins over
 * a confusing "nothing to cancel" error on a race.
 *
 * Validation order is parse → future-check → income-kind guard → delete,
 * so the in-memory checks short-circuit before the DB round-trip on the
 * most common reject path.
 */
export async function cancelScheduledBaselineAction(
  prev: IncomeActionState,
  formData: FormData,
): Promise<IncomeActionState> {
  try {
    const { categoryId, effectiveFrom } =
      parseCancelScheduledBaselineInput(formData);

    if (effectiveFrom <= currentMonthKey()) {
      throw new Error("Can only cancel a future-effective baseline");
    }

    await assertIncomeCategory(categoryId);
    await deleteCategoryTarget(categoryId, effectiveFrom);
    revalidatePath("/");
    return success(prev);
  } catch (err) {
    return failure(prev, err);
  }
}
