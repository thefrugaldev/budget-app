"use client";

import { DateRangeField } from "@/components/ui/DateRangeField";
import { useDateScope } from "@/hooks/useDateScope";
import {
  RANGE_PRESETS,
  presetDateBounds,
  presetForDateBounds,
  rangeLabel,
} from "@/lib/budget";
import { cn } from "@/lib/utils";

/** Chip styling shared with the legacy `RangeSelector` so the two read alike. */
const chip = (active: boolean) =>
  cn(
    "cursor-pointer rounded-full px-3 py-1 text-xs font-medium ring-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
    active
      ? "bg-foreground text-background ring-foreground"
      : "bg-card text-muted-foreground ring-border hover:text-foreground",
  );

/**
 * Unified date-scope control for the global `/transactions` list (issue #165
 * chunk 5). Collapses the old preset chips (server `?range=`) and the in-list
 * date-range filter into **one** authoritative window: the presets are
 * shortcuts that set a from/to, "All time" and the custom calendar widen beyond
 * any preset, and everything writes the same `from`/`to` the list scopes by —
 * so a preset and a custom range can no longer intersect to empty (problem #4).
 *
 * The scope is client-side and shallow (`useDateScope`): the page already ships
 * every transaction, so changing scope re-windows locally with no server
 * round-trip. `earliestDate` (the oldest transaction's date) anchors "All time"
 * so it reaches the full imported history; omit it to hide that chip.
 */
export function DateScopeSelector({
  now,
  earliestDate,
}: {
  now: Date;
  earliestDate?: string;
}) {
  const { raw, bounds, setScope } = useDateScope(now);

  const isDefault = !raw.from && !raw.to;
  const activePreset = isDefault ? "this-month" : presetForDateBounds(raw.from, raw.to, now);

  // "All time" spans the oldest transaction through the end of the current
  // month; it never coincides with a preset window (earliest is arbitrary).
  const allTime = earliestDate
    ? { from: earliestDate, to: presetDateBounds("this-month", now).to }
    : null;
  const isAllTime =
    allTime !== null && raw.from === allTime.from && raw.to === allTime.to;

  return (
    <nav aria-label="Date range" className="flex flex-wrap items-center gap-2">
      {RANGE_PRESETS.map((preset) => (
        <button
          key={preset}
          type="button"
          aria-pressed={activePreset === preset}
          onClick={() =>
            // This month is the default → clear the params for a clean URL;
            // every other preset writes its explicit window.
            setScope(preset === "this-month" ? { from: "", to: "" } : presetDateBounds(preset, now))
          }
          className={chip(activePreset === preset)}
        >
          {rangeLabel(preset)}
        </button>
      ))}
      {allTime && (
        <button
          type="button"
          aria-pressed={isAllTime}
          onClick={() => setScope(allTime)}
          className={chip(isAllTime)}
        >
          All time
        </button>
      )}
      <DateRangeField
        ariaLabel="Custom date range"
        from={bounds.from}
        to={bounds.to}
        onChange={setScope}
        placeholder="Custom range"
        className="w-full sm:w-auto sm:min-w-[220px]"
      />
    </nav>
  );
}
