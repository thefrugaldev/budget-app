/**
 * Lives in its own file (not `fire-assumptions.ts`) because that file carries the
 * `"use server"` directive, and Next.js' RSC pipeline only permits async-function
 * exports from a `"use server"` file — exporting a type or constant alongside the
 * actions silently breaks the action manifest at runtime (every POST 500s).
 * Mirrors the `net-worth-state` / `transactions-state` split.
 */
export type FireAssumptionsActionState = { error: string | null; ok: number };
export const FIRE_ASSUMPTIONS_ACTION_INITIAL: FireAssumptionsActionState = { error: null, ok: 0 };
