"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { currentMonthKey, nextMonth } from "@/lib/budget";
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

import {
  parseCategoryKind,
  parseMonthKey,
  parseMonthlyTarget,
  parseOptionalMonthKey,
} from "./category-parsers";
import type { CategoryActionState } from "./category-state";

function requireString(raw: FormDataEntryValue | null, field: string): string {
  if (typeof raw !== "string" || raw.trim() === "") {
    throw new Error(`Missing required field: ${field}`);
  }
  return raw.trim();
}

function success(prev: CategoryActionState, id?: string): CategoryActionState {
  return { error: null, ok: prev.ok + 1, id };
}

function failure(prev: CategoryActionState, err: unknown): CategoryActionState {
  const message = err instanceof Error ? err.message : "Something went wrong";
  return { error: message, ok: prev.ok };
}

function revalidateCategory(categoryId: string): void {
  revalidatePath("/");
  revalidatePath(`/categories/${categoryId}`);
}

/**
 * Creates a new expense / savings / income category plus its initial target
 * row at `activeFrom`. `activeFrom` defaults to the current month so the new
 * category's threshold meter is meaningful immediately. Returns the new
 * category id on `state.id` so the dialog can navigate to its detail page.
 */
export async function createCategoryAction(
  prev: CategoryActionState,
  formData: FormData,
): Promise<CategoryActionState> {
  try {
    const name = requireString(formData.get("name"), "name");
    const emoji = (formData.get("emoji") as string | null)?.trim() || "🪣";
    const kind = parseCategoryKind(formData.get("kind"));
    const monthly = parseMonthlyTarget(formData.get("monthly"));
    const activeFrom =
      parseOptionalMonthKey(formData.get("activeFrom"), "Active from") ??
      currentMonthKey();

    const category = await createCategory({ name, emoji, kind, activeFrom });
    await createCategoryTarget({
      categoryId: category.id,
      monthly,
      effectiveFrom: activeFrom,
    });

    revalidateCategory(category.id);
    return success(prev, category.id);
  } catch (err) {
    return failure(prev, err);
  }
}

/**
 * Patches the editable attributes of a category — name, emoji, kind, and the
 * full active range (`activeFrom` + optional `activeUntil`). Target changes go
 * through `upsertCategoryTargetAction`. `endCategoryAction` is the one-click
 * "retire as of this month" shortcut; this action is the long-form path that
 * also lets the user pick an arbitrary end month or clear it entirely
 * (matching the `reopenCategoryAction` one-click path).
 */
export async function updateCategoryAction(
  prev: CategoryActionState,
  formData: FormData,
): Promise<CategoryActionState> {
  try {
    const id = requireString(formData.get("id"), "id");
    const cat = await getCategoryById(id);
    if (!cat) throw new Error("Category not found");

    const name = requireString(formData.get("name"), "name");
    const emoji = (formData.get("emoji") as string | null)?.trim() || cat.emoji;
    const kind = parseCategoryKind(formData.get("kind"));
    const activeFrom = parseMonthKey(formData.get("activeFrom"), "Active from");
    const activeUntil = parseOptionalMonthKey(
      formData.get("activeUntil"),
      "Active until",
    );
    if (activeUntil !== undefined && activeUntil < activeFrom) {
      throw new Error("Active until must be on or after Active from");
    }

    await updateCategory(id, {
      name,
      emoji,
      kind,
      activeFrom,
      ...(activeUntil !== undefined
        ? { activeUntil }
        : { clearActiveUntil: true }),
    });
    revalidateCategory(id);
    return success(prev, id);
  } catch (err) {
    return failure(prev, err);
  }
}

/**
 * Ends a category by setting `activeUntil` to the current month — the category
 * stays on its detail page (history preserved) but is excluded from the
 * overview from next month forward. The mirror to `endIncomeSourceAction`,
 * but applies to any kind.
 */
export async function endCategoryAction(
  prev: CategoryActionState,
  formData: FormData,
): Promise<CategoryActionState> {
  try {
    const id = requireString(formData.get("id"), "id");
    const cat = await getCategoryById(id);
    if (!cat) throw new Error("Category not found");

    await updateCategory(id, { activeUntil: currentMonthKey() });
    revalidateCategory(id);
    return success(prev, id);
  } catch (err) {
    return failure(prev, err);
  }
}

/**
 * Clears `activeUntil` — un-ends a category that was retired earlier. The
 * detail-page edit panel exposes this when an end date is set so a mis-ended
 * category can be brought back without manual DB surgery.
 */
export async function reopenCategoryAction(
  prev: CategoryActionState,
  formData: FormData,
): Promise<CategoryActionState> {
  try {
    const id = requireString(formData.get("id"), "id");
    const cat = await getCategoryById(id);
    if (!cat) throw new Error("Category not found");

    await updateCategory(id, { clearActiveUntil: true });
    revalidateCategory(id);
    return success(prev, id);
  } catch (err) {
    return failure(prev, err);
  }
}

/**
 * Hard-deletes a category and its target rows. Server-side gate: only allowed
 * when the category has zero transactions and at most one target row (its
 * initial). Anything else gets "End category" (`activeUntil`) instead.
 *
 * On success, `redirect("/")` from inside the action — the alternative of
 * returning normal state and navigating from a client `useEffect` races the
 * post-action revalidation: Next re-renders the still-mounted detail page,
 * `getCategoryById` returns undefined, `notFound()` fires, and the user
 * sees a 404 flash before the client effect can route away.
 */
export async function deleteCategoryAction(
  prev: CategoryActionState,
  formData: FormData,
): Promise<CategoryActionState> {
  let deleted = false;
  try {
    const id = requireString(formData.get("id"), "id");
    const cat = await getCategoryById(id);
    if (!cat) throw new Error("Category not found");

    const [txCount, targets] = await Promise.all([
      countTransactionsForCategory(id),
      listCategoryTargetsFor(id),
    ]);
    if (txCount > 0) {
      throw new Error("Category has transactions — end it instead of deleting");
    }
    if (targets.length > 1) {
      throw new Error("Category has target history — end it instead of deleting");
    }

    await deleteAllCategoryTargets(id);
    await deleteCategory(id);
    revalidatePath("/");
    deleted = true;
  } catch (err) {
    return failure(prev, err);
  }
  // `redirect()` throws a special error Next.js intercepts to issue a 303 —
  // it MUST run outside the try/catch above, otherwise our `failure()` path
  // swallows it and the user sees nothing happen. Suppress the unused-var
  // warning by gating on the boolean.
  if (deleted) redirect("/");
  return success(prev);
}

/**
 * Writes/updates a target row at the chosen `effectiveFrom`. Used by both
 * the inline target editor on the detail page (with the "apply this month"
 * toggle deciding effectiveFrom) and the history viewer's row-level "Edit"
 * affordance. Idempotent at `(categoryId, effectiveFrom)`.
 */
export async function upsertCategoryTargetAction(
  prev: CategoryActionState,
  formData: FormData,
): Promise<CategoryActionState> {
  try {
    const categoryId = requireString(formData.get("categoryId"), "categoryId");
    const cat = await getCategoryById(categoryId);
    if (!cat) throw new Error("Category not found");

    const monthly = parseMonthlyTarget(formData.get("monthly"));
    const applyThisMonth = formData.get("applyThisMonth") === "on";
    const explicit = parseOptionalMonthKey(
      formData.get("effectiveFrom"),
      "Effective from",
    );
    const thisMonth = currentMonthKey();
    const effectiveFrom = explicit ?? (applyThisMonth ? thisMonth : nextMonth(thisMonth));

    await upsertCategoryTarget({ categoryId, monthly, effectiveFrom });
    revalidateCategory(categoryId);
    return success(prev, categoryId);
  } catch (err) {
    return failure(prev, err);
  }
}

/**
 * Deletes a target row by composite key. Disallows removing the only target
 * row a category has — without at least one row, `resolveTargetForMonth`
 * returns 0 and the threshold meter goes mute.
 */
export async function deleteCategoryTargetAction(
  prev: CategoryActionState,
  formData: FormData,
): Promise<CategoryActionState> {
  try {
    const categoryId = requireString(formData.get("categoryId"), "categoryId");
    const effectiveFrom = parseMonthKey(
      formData.get("effectiveFrom"),
      "Effective from",
    );
    const cat = await getCategoryById(categoryId);
    if (!cat) throw new Error("Category not found");

    const rows = await listCategoryTargetsFor(categoryId);
    if (rows.length <= 1) {
      throw new Error("Can't remove the only target row");
    }

    await deleteCategoryTarget(categoryId, effectiveFrom);
    revalidateCategory(categoryId);
    return success(prev, categoryId);
  } catch (err) {
    return failure(prev, err);
  }
}
