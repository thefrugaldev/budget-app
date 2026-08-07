/**
 * How a card-grid surface lays its items out — the single, app-wide view
 * preference behind the shared `ViewToggle` (#203). `"card"` is the chunky,
 * glanceable default; `"list"` is the dense, value-aligned reconciliation view.
 * One preference is shared across every card-grid surface, not one per surface.
 */
export type ViewPreference = "card" | "list";
