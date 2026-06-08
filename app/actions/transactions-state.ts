/**
 * Lives in its own file (not `transactions.ts`) because the latter carries a
 * `"use server"` directive, and Next.js' RSC pipeline only permits async-
 * function exports from `"use server"` files. Re-exporting a type + a
 * plain constant alongside the action silently breaks every server action
 * in the build (manifest resolution fails at runtime, every POST 500s).
 *
 * Mirrors the `income-state.ts` / `income.ts` split from chunk 6.
 */
export type TransactionActionState = { error: string | null; ok: number };
export const TX_ACTION_INITIAL: TransactionActionState = { error: null, ok: 0 };
