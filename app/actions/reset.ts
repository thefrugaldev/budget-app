"use server";

import { revalidatePath } from "next/cache";

import { resetAllData } from "@/lib/db/reset";

/**
 * Danger-zone reset (#81 story 9). Clears all local data, then revalidates
 * every data-bearing route so the app immediately reflects the blank slate.
 * Invoked fire-and-forget from the confirmation dialog, so it returns a plain
 * `{ error }` shape (like `deleteTransactionAction`) rather than the
 * `useActionState` one.
 */
export async function resetAllDataAction(): Promise<{ error: string | null }> {
  try {
    await resetAllData();
    revalidatePath("/");
    revalidatePath("/transactions");
    revalidatePath("/income");
    revalidatePath("/settings");
    return { error: null };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Reset failed" };
  }
}
