/**
 * Pure budget-domain helpers. This barrel is the module's public API — import
 * from `@/lib/budget` rather than reaching into the cluster files directly.
 * The split is by cohesive concern (see #48):
 *
 *   - format.ts             currency + date-label formatting
 *   - amount.ts             AmountInput entry/format helpers (units <-> string)
 *   - range.ts              month-key math + range-preset windows
 *   - threshold.ts          cap/goal threshold state + signal palette
 *   - aggregate.ts          totals, target resolution, range + income aggregation
 *   - attention.ts          Pulse "Needs attention" exception selector
 *   - target-suggestion.ts  Target-suggestion detector + proposed-value helper
 *   - labels.ts             kind-aware target / sign-flip labels
 *   - transaction-filter.ts prefill, vendor suggestions, filter predicate
 */
export * from "./format";
export * from "./amount";
export * from "./range";
export * from "./threshold";
export * from "./aggregate";
export * from "./attention";
export * from "./target-suggestion";
export * from "./labels";
export * from "./transaction-filter";
