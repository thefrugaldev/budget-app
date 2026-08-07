/**
 * Time-range selection shared by every page driven by the `?range=` preset
 * (Pulse, Transactions, category detail) and the budget range helpers. The
 * canonical ordered preset list and the resolution logic live in
 * `@/lib/budget` (range.ts); `RANGE_PRESETS` is checked against this union via
 * `satisfies`.
 */

export type RangePreset =
  | "this-month"
  | "last-month"
  | "last-3-months"
  | "ytd"
  | "last-12-months";

export type RangeSelection = {
  preset: RangePreset;
  ymStart: string;
  ymEnd: string;
};

/**
 * How a date-scope change is committed to the URL (see `useDateScope`):
 * - `"shallow"` — `window.history.replaceState`, no server round-trip. For a
 *   page that ships its data once and re-windows client-side (`/transactions`).
 * - `"navigate"` — `router.replace` (soft navigation), which re-runs the
 *   dynamic server component. For a server-aggregated page (Pulse) that must
 *   re-derive its figures from the new window.
 */
export type DateScopeCommit = "shallow" | "navigate";
