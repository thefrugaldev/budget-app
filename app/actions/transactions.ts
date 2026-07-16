"use server";

import { revalidatePath } from "next/cache";

import { requireRole } from "@/lib/auth/require-role";
import { getCategoryById } from "@/lib/repositories/categories";
import {
  createTransaction,
  deleteManyTransactions,
  deleteTransaction,
  updateManyTransactions,
  updateTransaction,
} from "@/lib/repositories/transactions";

import {
  applySign,
  parseIsoDate,
  parsePositiveAmount,
  parseTransactionIds,
  parseVendorName,
} from "./transaction-parsers";
import type { TransactionActionState } from "./transactions-state";

function requireString(raw: FormDataEntryValue | null, field: string): string {
  if (typeof raw !== "string" || raw.trim() === "") {
    throw new Error(`Missing required field: ${field}`);
  }
  return raw.trim();
}

function optionalString(raw: FormDataEntryValue | null): string | undefined {
  if (typeof raw !== "string") return undefined;
  const trimmed = raw.trim();
  return trimmed === "" ? undefined : trimmed;
}

function success(prev: TransactionActionState): TransactionActionState {
  return { error: null, ok: prev.ok + 1 };
}

function failure(prev: TransactionActionState, err: unknown): TransactionActionState {
  const message = err instanceof Error ? err.message : "Something went wrong";
  return { error: message, ok: prev.ok };
}

/**
 * Persists a new transaction from the shared TransactionForm. The form
 * submits a positive-only `amount` and a separate `sign` ("+" | "-") drawn
 * from the kind-aware segmented control; the action multiplies them so the
 * stored `Transaction.amount` is signed (refunds/withdrawals/reversals are
 * native negative values). Revalidates the Pulse + category-detail pages so
 * the new row shows up without a hard reload.
 */
export async function createTransactionAction(
  prev: TransactionActionState,
  formData: FormData,
): Promise<TransactionActionState> {
  try {
    await requireRole("editor");
    const categoryId = requireString(formData.get("categoryId"), "categoryId");
    const category = await getCategoryById(categoryId);
    if (!category) throw new Error("Category not found");

    const date = parseIsoDate(formData.get("date"));
    const amount = applySign(parsePositiveAmount(formData.get("amount")), formData.get("sign"));
    // Vendor is required on Add (#166 story 23) so an incomplete new
    // transaction can't be saved; the server is the boundary, the client
    // `required` only hides the affordance. Edit stays optional (below) so a
    // vendorless imported row still round-trips.
    const vendor = parseVendorName(formData.get("vendor"));
    const note = optionalString(formData.get("note"));

    await createTransaction({ categoryId, date, amount, vendor, note });

    revalidatePath("/");
    revalidatePath(`/categories/${categoryId}`);
    return success(prev);
  } catch (err) {
    return failure(prev, err);
  }
}

/**
 * Persists an edit to an existing transaction (chunk 8 row overflow → Edit).
 * The form submits a hidden `id` for the row being edited and a hidden
 * `originalCategoryId` so we can revalidate the previous detail page when
 * the user re-categorizes (story 45). The new `categoryId` is read from the
 * regular category picker — the same field as Add — which keeps the
 * single-form-shape invariant from chunk 7.
 */
export async function updateTransactionAction(
  prev: TransactionActionState,
  formData: FormData,
): Promise<TransactionActionState> {
  try {
    await requireRole("editor");
    const id = requireString(formData.get("id"), "id");
    const categoryId = requireString(formData.get("categoryId"), "categoryId");
    const category = await getCategoryById(categoryId);
    if (!category) throw new Error("Category not found");

    const date = parseIsoDate(formData.get("date"));
    const amount = applySign(parsePositiveAmount(formData.get("amount")), formData.get("sign"));
    const vendor = optionalString(formData.get("vendor"));
    const note = optionalString(formData.get("note"));

    const hit = await updateTransaction(id, { categoryId, date, amount, vendor, note });
    if (!hit) throw new Error("Transaction not found");

    revalidatePath("/");
    revalidatePath(`/categories/${categoryId}`);
    const originalCategoryId = optionalString(formData.get("originalCategoryId"));
    if (originalCategoryId && originalCategoryId !== categoryId) {
      revalidatePath(`/categories/${originalCategoryId}`);
    }
    return success(prev);
  } catch (err) {
    return failure(prev, err);
  }
}

/**
 * Fire-and-forget delete used by the row overflow menu after the undo toast
 * expires (story 47 — no soft-delete, no trash view). The action is invoked
 * directly from a client effect rather than a form submit, so it returns a
 * plain `{ error: string | null }` shape instead of the useActionState one.
 */
export async function deleteTransactionAction(input: {
  id: string;
  categoryId: string;
}): Promise<{ error: string | null }> {
  try {
    await requireRole("editor");
    const hit = await deleteTransaction(input.id);
    if (!hit) throw new Error("Transaction not found");
    revalidatePath("/");
    revalidatePath(`/categories/${input.categoryId}`);
    return { error: null };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Delete failed" };
  }
}

/**
 * Revalidates Pulse plus each distinct category detail page touched by a bulk
 * operation. Local (not exported) — `"use server"` files may only export
 * async functions (see `transactions-state.ts`), but plain helpers are fine.
 */
function revalidateCategories(categoryIds: Iterable<string>) {
  revalidatePath("/");
  // `/transactions` (chunk 5) reads across every category — keep it fresh too.
  revalidatePath("/transactions");
  for (const id of new Set(categoryIds)) {
    revalidatePath(`/categories/${id}`);
  }
}

/**
 * Bulk delete (issue #17 chunk 4, stories 11/12/16). Invoked fire-and-forget
 * from the bulk action bar after the undo window expires — same shape as the
 * single-row `deleteTransactionAction`. `categoryIds` carries every category
 * the selected rows belong to so each affected detail page revalidates; on the
 * category page that's usually one id, on `/transactions` it can be many.
 */
export async function bulkDeleteTransactionsAction(input: {
  ids: string[];
  categoryIds: string[];
}): Promise<{ error: string | null; deleted: number }> {
  try {
    await requireRole("editor");
    const ids = parseTransactionIds(input.ids);
    const deleted = await deleteManyTransactions(ids);
    revalidateCategories(input.categoryIds);
    return { error: null, deleted };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Bulk delete failed",
      deleted: 0,
    };
  }
}

/**
 * Bulk recategorise (story 13/20) and bulk vendor rename (story 14) — both are
 * a single `$set` over the selected ids. Exactly one of `categoryId` / `vendor`
 * is expected; recategorise validates the target category exists and adds it to
 * the revalidation set (the source pages come from `categoryIds`). The action
 * is awaited by the bar so the success/error toast can report the outcome.
 */
export async function bulkUpdateTransactionsAction(input: {
  ids: string[];
  categoryIds: string[];
  patch: { categoryId?: string; vendor?: string };
}): Promise<{ error: string | null; updated: number }> {
  try {
    await requireRole("editor");
    const ids = parseTransactionIds(input.ids);

    const patch: { categoryId?: string; vendor?: string } = {};
    if (input.patch.categoryId !== undefined) {
      const target = await getCategoryById(input.patch.categoryId);
      if (!target) throw new Error("Category not found");
      patch.categoryId = input.patch.categoryId;
    }
    if (input.patch.vendor !== undefined) {
      patch.vendor = parseVendorName(input.patch.vendor);
    }
    if (Object.keys(patch).length === 0) {
      throw new Error("Nothing to update");
    }

    const updated = await updateManyTransactions(ids, patch);
    revalidateCategories([...input.categoryIds, ...(patch.categoryId ? [patch.categoryId] : [])]);
    return { error: null, updated };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Bulk update failed",
      updated: 0,
    };
  }
}
