"use server";

import { revalidatePath } from "next/cache";

import { AuthorizationError, requireRole } from "@/lib/auth/require-role";
import { resetAllData } from "@/lib/db/reset";

/**
 * Danger-zone reset (#81 story 9). Clears the household's local data, then
 * revalidates every data-bearing route so the app immediately reflects the
 * blank slate. Imported archive history is spared unless the caller opts in via
 * `includeImported` (#118 story 14). Invoked fire-and-forget from the
 * confirmation dialog, so it returns a plain `{ error }` shape (like
 * `deleteTransactionAction`) rather than the `useActionState` one.
 */
export async function resetAllDataAction(
  input?: { includeImported?: boolean },
): Promise<{ error: string | null }> {
  try {
    // Danger zone is owner-only (#111 chunk 5); editors and viewers can't reset.
    await requireRole("owner");
    // Imported archive history is spared unless the owner explicitly opts in
    // (#118 story 14). `=== true` so a malformed client payload can't widen the
    // deletion.
    await resetAllData({ includeImported: input?.includeImported === true });
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
