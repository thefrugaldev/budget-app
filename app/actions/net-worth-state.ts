/**
 * Lives in its own file (not `net-worth.ts`) because that file carries the
 * `"use server"` directive, and Next.js' RSC pipeline only permits async-
 * function exports from a `"use server"` file — exporting a type or constant
 * alongside the actions silently breaks the action manifest at runtime (every
 * POST 500s). Mirrors the `transactions-state` / `category-state` split.
 */
export type NetWorthActionState = { error: string | null; ok: number; id?: string };
export const NET_WORTH_ACTION_INITIAL: NetWorthActionState = { error: null, ok: 0 };
