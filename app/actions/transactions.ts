"use server";

import { revalidatePath } from "next/cache";

import { getCategoryById } from "@/lib/repositories/categories";
import { createTransaction } from "@/lib/repositories/transactions";

import {
  applySign,
  parseIsoDate,
  parsePositiveAmount,
} from "./transaction-parsers";

export type TransactionActionState = { error: string | null; ok: number };
export const TX_ACTION_INITIAL: TransactionActionState = { error: null, ok: 0 };

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
