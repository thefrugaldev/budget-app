"use client";

import { ChevronDown } from "lucide-react";

import { DateRangeField } from "@/components/ui/DateRangeField";
import { useDateScope } from "@/hooks/useDateScope";
import {
  activeCalendarYear,
  availableYears,
  calendarYearBounds,
  presetDateBounds,
  presetForDateBounds,
  RANGE_PRESETS,
  rangeLabel,
} from "@/lib/budget";
import { cn } from "@/lib/utils";
import type { DateScopeCommit } from "@/types/range";

/** Chip styling shared with the legacy `RangeSelector` so the two read alike. */
const chip = (active: boolean) =>
  cn(
    "cursor-pointer rounded-full px-3 py-1 text-xs font-medium ring-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
    active
      ? "bg-foreground text-background ring-foreground"
      : "bg-card text-muted-foreground ring-border hover:text-foreground",
  );

/**
 * Unified date-scope control across the app's time-scoped pages — the global
 * `/transactions` list (issue #165 chunk 5) and Pulse (#160). It collapses the
 * old preset chips and the in-list date filter into **one** authoritative
 * window: presets are shortcuts that set a from/to, a **year** selector and
 * "All time" reach into imported history, the custom calendar covers arbitrary
 * spans, and everything writes the same `from`/`to` — so a preset and a custom
 * range can no longer intersect to empty (problem #4).
 *
 * `commit` selects how a change reaches the URL (see {@link DateScopeCommit}):
 * `"shallow"` (default) re-windows client-side with no server round-trip — for a
 * page that ships its data once (`/transactions`); `"navigate"` soft-navigates
 * so a server-aggregated page (Pulse) re-derives its figures. The `from`/`to`
 * contract is identical either way.
 *
 * `earliestDate` (the oldest record's date) anchors "All time" to the full
 * imported history and bounds the year selector's options; omit it to hide
 * both.
 */
export function DateScopeSelector({
  now,
  earliestDate,
  commit = "shallow",
}: {
  now: Date;
  earliestDate?: string;
  commit?: DateScopeCommit;
}) {
  const { raw, bounds, setScope } = useDateScope(now, commit);

  const isDefault = !raw.from && !raw.to;
  const activePreset = isDefault ? "this-month" : presetForDateBounds(raw.from, raw.to, now);

  // "All time" spans the oldest record through the end of the current month; it
  // never coincides with a preset window (earliest is arbitrary).
  const allTime = earliestDate
    ? { from: earliestDate, to: presetDateBounds("this-month", now).to }
    : null;
  const isAllTime =
    allTime !== null && raw.from === allTime.from && raw.to === allTime.to;

  // Complete past years with data, for the year selector (story 1). The active
  // year is the window when it's exactly a calendar year — never in the default.
  const years = availableYears(earliestDate, now);
  const activeYear = isDefault ? null : activeCalendarYear(raw.from, raw.to);

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
      {years.length > 0 && (
        <div className="relative">
          <select
            aria-label="Year"
            value={activeYear ?? ""}
            onChange={(event) => {
              if (event.target.value) setScope(calendarYearBounds(Number(event.target.value)));
            }}
            className={cn(chip(activeYear !== null), "appearance-none pr-7")}
          >
            <option value="" disabled>
              Year
            </option>
            {years.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
          <ChevronDown
            className="pointer-events-none absolute right-2 top-1/2 size-3.5 -translate-y-1/2"
            aria-hidden
          />
        </div>
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
