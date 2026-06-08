"use server";

import { revalidatePath } from "next/cache";

import { getCategoryById } from "@/lib/repositories/categories";
import {
  createTransaction,
  deleteTransaction,
  updateTransaction,
} from "@/lib/repositories/transactions";

import {
  applySign,
  parseIsoDate,
  parsePositiveAmount,
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
    const categoryId = requireString(formData.get("categoryId"), "categoryId");
    const category = await getCategoryById(categoryId);
    if (!category) throw new Error("Category not found");

    const date = parseIsoDate(formData.get("date"));
    const amount = applySign(parsePositiveAmount(formData.get("amount")), formData.get("sign"));
    const vendor = optionalString(formData.get("vendor"));
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
    const hit = await deleteTransaction(input.id);
    if (!hit) throw new Error("Transaction not found");
    revalidatePath("/");
    revalidatePath(`/categories/${input.categoryId}`);
    return { error: null };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Delete failed" };
  }
}
