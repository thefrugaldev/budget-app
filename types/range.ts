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
