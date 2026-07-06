"use server";

import { revalidatePath } from "next/cache";

import { AuthorizationError, requireRole } from "@/lib/auth/require-role";
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
    // Danger zone is owner-only (#111 chunk 5); editors and viewers can't reset.
    await requireRole("owner");
    await resetAllData();
    revalidatePath("/");
    revalidatePath("/transactions");
    revalidatePath("/income");
    revalidatePath("/settings");
    return { error: null };
  } catch (err) {
    // A permission denial carries intentional, safe-to-show copy — surface it
    // so a non-owner gets the same clear reason the other actions give. Any
    // other error stays generic: never leak an internal boundary string to the
    // dialog (e.g. requireHouseholdId's "No active household session" if the
    // session flips active→denied between render and this fire-and-forget call).
    if (err instanceof AuthorizationError) return { error: err.message };
    return { error: "Reset failed" };
  }
}
