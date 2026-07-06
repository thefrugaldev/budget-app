"use server";

import { revalidatePath } from "next/cache";

import { requireRole } from "@/lib/auth/require-role";
import { currentMonthKey, nextMonth, resolveTargetForMonth } from "@/lib/budget";
import {
  createCategory,
  deleteCategory,
  getCategoryById,
  updateCategory,
} from "@/lib/repositories/categories";
import {
  createCategoryTarget,
  deleteAllCategoryTargets,
  deleteCategoryTarget,
  listCategoryTargetsFor,
  upsertCategoryTarget,
} from "@/lib/repositories/categoryTargets";
import { countTransactionsForCategory } from "@/lib/repositories/transactions";

import { monthlyFromCadence, monthlyToYearly } from "@/lib/income";

import {
  parseCancelScheduledBaselineInput,
  parseIncomeFrequency,
  parseOptionalFirstPaycheckDate,
  parsePayCadence,
  parsePerPaycheck,
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
 * Persists an inline edit to an income source's frequency-shaped fields
 * (#46 chunk 7). One action, branched by the submitted frequency so the editor
 * doesn't fork by kind (story 11):
 *
 *  - **one-time** — sets `incomeFrequency: "one-time"`, clears `payCadence`, and
 *    deletes every baseline target. A one-time source is measured by its
 *    receipts, not a baseline (story 12); the editor confirms before this
 *    discard. Idempotent when the source is already one-time.
 *  - **recurring** — persists `payCadence` (the "set pay cadence" path for a
 *    migrated legacy source), then writes a new effective-dated baseline from
 *    the yearly amount (stored monthly ÷ 12, ADR 0001). The baseline write is
 *    *conditional*: a cadence-only change touches no target row, so it can't
 *    spawn a redundant "scheduled change → same value" row. A genuine amount
 *    change, an `applyThisMonth` toggle, or a source with no baseline yet
 *    (switching one-time → recurring) all trigger the write.
 *
 * `applyThisMonth` toggles effective-from between the current and next month;
 * a source gaining its first baseline always lands in the current month so it
 * contributes immediately.
 */
export async function updateIncomeSourceAction(
  prev: IncomeActionState,
  formData: FormData,
): Promise<IncomeActionState> {
  try {
    await requireRole("editor");
    const categoryId = requireString(formData.get("categoryId"), "categoryId");
    await assertIncomeCategory(categoryId);
    const frequency = parseIncomeFrequency(formData.get("frequency"));

    if (frequency === "one-time") {
      await updateCategory(categoryId, {
        incomeFrequency: "one-time",
        clearPayCadence: true,
        clearFirstPaycheckDate: true,
      });
      await deleteAllCategoryTargets(categoryId);
      revalidatePath("/");
      revalidatePath("/income");
      return success(prev);
    }

    const cadence = parsePayCadence(formData.get("cadence"));
    const firstPaycheckDate = parseOptionalFirstPaycheckDate(
      formData.get("firstPaycheckDate"),
    );
    const yearly = parseYearly(formData.get("yearly"));
    const applyThisMonth = formData.get("applyThisMonth") === "on";

    await updateCategory(categoryId, {
      incomeFrequency: "recurring",
      payCadence: cadence,
      // Persist when provided; an emptied field clears the anchor so the source
      // reverts to the activeFrom fallback.
      ...(firstPaycheckDate !== undefined
        ? { firstPaycheckDate }
        : { clearFirstPaycheckDate: true }),
    });

    const thisMonth = currentMonthKey();
    const existing = await listCategoryTargetsFor(categoryId);
    const currentMonthly = resolveTargetForMonth(categoryId, thisMonth, existing);
    const monthly = yearly / 12;
    // Compare in the same rounded-yearly space the editor's dirty check uses, so
    // a reopened-and-resaved clean amount doesn't write a no-op row.
    const amountChanged = yearly !== monthlyToYearly(currentMonthly);

    if (existing.length === 0 || amountChanged || applyThisMonth) {
      const effectiveFrom =
        existing.length === 0 || applyThisMonth ? thisMonth : nextMonth(thisMonth);
      await upsertCategoryTarget({ categoryId, monthly, effectiveFrom });
      // Collapse redundant immediately-next future target(s). After this write,
      // resolving any month M >= effectiveFrom returns the most recent target
      // with effectiveFrom <= M, so a future row whose `monthly` equals the
      // chain value is a no-op for every month it covers — removing it changes
      // nothing. Without this an "Apply this month" edit matching a queued
      // change leaves both rows, and the card reads "Scheduled change → $X"
      // when $X is already in effect. See PR #47 / issue #39.
      await collapseRedundantForwardTargets(categoryId, effectiveFrom, monthly);
    }

    revalidatePath("/");
    revalidatePath("/income");
    return success(prev);
  } catch (err) {
    return failure(prev, err);
  }
}

async function collapseRedundantForwardTargets(
  categoryId: string,
  fromEffective: string,
  chainMonthly: number,
): Promise<void> {
  const all = await listCategoryTargetsFor(categoryId);
  const future = all
    .filter((t) => t.effectiveFrom > fromEffective)
    .sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom));
  for (const t of future) {
    if (t.monthly !== chainMonthly) return;
    await deleteCategoryTarget(categoryId, t.effectiveFrom);
  }
}

/**
 * Adds a brand-new income source from the two-step Add Source form (#46).
 * `activeFrom` defaults to the current month so the source contributes to
 * today's annualized header value immediately. The shape branches on the
 * step-1 frequency:
 *
 *  - **recurring** — stores `payCadence` and an initial baseline target whose
 *    monthly value is derived from the per-paycheck amount via
 *    `monthlyFromCadence`, so storage stays monthly (ADR 0001) while the user
 *    enters their natural per-paycheck unit (story 3).
 *  - **one-time** — `incomeFrequency: "one-time"` with **no** target row; a
 *    one-time source has no baseline, its story is its received transactions
 *    (story 5).
 */
export async function createIncomeSourceAction(
  prev: IncomeActionState,
  formData: FormData,
): Promise<IncomeActionState> {
  try {
    await requireRole("editor");
    const name = requireString(formData.get("name"), "name");
    const icon = (formData.get("icon") as string | null)?.trim() || undefined;
    const frequency = parseIncomeFrequency(formData.get("frequency"));
    const activeFrom = currentMonthKey();

    if (frequency === "recurring") {
      const cadence = parsePayCadence(formData.get("cadence"));
      const perPaycheck = parsePerPaycheck(formData.get("amountPerPaycheck"));
      const firstPaycheckDate = parseOptionalFirstPaycheckDate(
        formData.get("firstPaycheckDate"),
      );
      const category = await createCategory({
        name,
        icon,
        kind: "income",
        activeFrom,
        incomeFrequency: "recurring",
        payCadence: cadence,
        firstPaycheckDate,
      });
      await createCategoryTarget({
        categoryId: category.id,
        monthly: monthlyFromCadence(perPaycheck, cadence),
        effectiveFrom: activeFrom,
      });
    } else {
      await createCategory({
        name,
        icon,
        kind: "income",
        activeFrom,
        incomeFrequency: "one-time",
      });
    }

    revalidatePath("/");
    revalidatePath("/income");
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
    await requireRole("editor");
    const { categoryId, effectiveFrom } =
      parseCancelScheduledBaselineInput(formData);

    if (effectiveFrom <= currentMonthKey()) {
      throw new Error("Can only cancel a future-effective baseline");
    }

    await assertIncomeCategory(categoryId);
    await deleteCategoryTarget(categoryId, effectiveFrom);
    revalidatePath("/");
    revalidatePath("/income");
    return success(prev);
  } catch (err) {
    return failure(prev, err);
  }
}

/**
 * Hard-deletes an income source and its target rows. Server-side gate
 * mirrors `deleteCategoryAction`: only allowed when the source has zero
 * transactions and at most one target row (its initial baseline). Anything
 * else gets "End source" instead.
 *
 * Unlike `deleteCategoryAction`, this action does **not** `redirect()` —
 * the `/income` list is the surface, and the deleted row simply drops out
 * of the next render. The category-side action redirects because it's
 * driven from a detail page that would 404 after the entity is gone; the
 * list view has no such race.
 */
export async function deleteIncomeSourceAction(
  prev: IncomeActionState,
  formData: FormData,
): Promise<IncomeActionState> {
  try {
    await requireRole("editor");
    const id = requireString(formData.get("id"), "id");
    await assertIncomeCategory(id);

    const [txCount, targets] = await Promise.all([
      countTransactionsForCategory(id),
      listCategoryTargetsFor(id),
    ]);
    if (txCount > 0) {
      throw new Error("Source has transactions — end it instead of deleting");
    }
    if (targets.length > 1) {
      throw new Error("Source has target history — end it instead of deleting");
    }

    await deleteAllCategoryTargets(id);
    await deleteCategory(id);
    revalidatePath("/");
    revalidatePath("/income");
    return success(prev);
  } catch (err) {
    return failure(prev, err);
  }
}
