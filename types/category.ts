/**
 * Shared category-domain view types (types the *data* model — `Category`,
 * `CategoryTarget` — lives in `budget.ts`; this file is for derived UI
 * descriptors the ledger surfaces compute).
 */

/**
 * The "nothing logged" chip state for a Categories ledger row, derived by
 * `categoryZeroState` (`lib/category/cadence.ts`) and rendered by
 * `NoActivityChip`. `warn` is the actionable case (an expected-monthly category
 * silent in the in-progress month — a possibly-missed bill); `muted` is every
 * other zero (for a spend-limit category, quietly the good outcome). The word
 * carries the meaning; tone only reinforces it.
 */
export type CategoryZeroState = { label: string; tone: "warn" | "muted" };
