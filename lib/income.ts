import type { Category, CategoryTarget } from "@/types/budget";
import { monthLabel } from "./budget";

export type IncomeSourceStatus = "active" | "scheduled-change" | "ended";

/**
 * Soonest `CategoryTarget` row for `categoryId` with
 * `effectiveFrom > currentMonth`. Returns `undefined` when no
 * future-effective row exists.
 *
 * Used by the `/income` card display (to surface the queued change in the
 * summary line) and by the per-row actions menu (to populate the
 * `cancelScheduledBaselineAction` form with the right `effectiveFrom`).
 */
export function nextScheduledTarget(
  categoryId: string,
  currentMonth: string,
  targets: CategoryTarget[],
): CategoryTarget | undefined {
  let best: CategoryTarget | undefined;
  for (const t of targets) {
    if (t.categoryId !== categoryId) continue;
    if (t.effectiveFrom <= currentMonth) continue;
    if (!best || t.effectiveFrom < best.effectiveFrom) best = t;
  }
  return best;
}

/**
 * Classifies an income source's row status for the `/income` page status pill.
 *
 * - "ended" wins when `activeUntil <= currentMonth` — the source has been
 *   marked as ending no later than the current month. (Per PRD: a source
 *   ending this month already reads as "ended" in the editor even though
 *   `isCategoryActiveForMonth` still treats the bound as inclusive.)
 * - "scheduled-change" applies to non-ended sources that have a
 *   `CategoryTarget` row with `effectiveFrom > currentMonth`. A past- or
 *   current-effective target is just the current baseline, not a queued change.
 * - "active" is the default.
 */
export function classifyIncomeSourceStatus(
  source: Category,
  currentMonth: string,
  targets: CategoryTarget[],
): IncomeSourceStatus {
  if (source.activeUntil && source.activeUntil <= currentMonth) return "ended";
  for (const t of targets) {
    if (t.categoryId !== source.id) continue;
    if (t.effectiveFrom > currentMonth) return "scheduled-change";
  }
  return "active";
}

/**
 * Display label for an income source row. Returns the bare name when no other
 * source shares the same normalized name; otherwise appends a status-aware
 * suffix so colliding rows are tellable apart at a glance
 * (e.g. `Bonus · scheduled change`, `Bonus · ended June 2026`).
 *
 * Collisions are case-insensitive and whitespace-trimmed.
 */
export function buildIncomeSourceDisplayLabel(
  source: Category,
  allSources: Category[],
  status: IncomeSourceStatus,
): string {
  const trimmedName = source.name.trim();
  const normalized = trimmedName.toLowerCase();
  const hasCollision = allSources.some(
    (other) =>
      other.id !== source.id && other.name.trim().toLowerCase() === normalized,
  );
  if (!hasCollision) return trimmedName;

  let suffix: string;
  switch (status) {
    case "ended":
      // `activeUntil` is guaranteed set when status === "ended" (see classifier).
      suffix = `ended ${monthLabel(source.activeUntil!)}`;
      break;
    case "scheduled-change":
      suffix = "scheduled change";
      break;
    case "active":
      suffix = `since ${monthLabel(source.activeFrom)}`;
      break;
  }
  return `${trimmedName} · ${suffix}`;
}
