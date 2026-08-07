/**
 * Month-key arithmetic ("YYYY-MM") and the range-preset window resolution that
 * drives the page-wide time-horizon selector. Month keys are lexically
 * comparable by design, so range checks elsewhere reduce to string comparison.
 */

import type { RangePreset, RangeSelection } from "@/types/range";

export function currentMonthKey(today = new Date()): string {
  return `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function currentYearStart(today = new Date()): string {
  return `${today.getUTCFullYear()}-01-01`;
}

/**
 * Fraction of the current month elapsed by `today`, in (0, 1]: day D of an
 * N-day month is `D / N` (day 1 of a 30-day month → ~0.03, the last day → 1).
 * The straight-line "expected by now" pace the attention selector compares a
 * savings goal's funding against for the in-progress current month (#178).
 * UTC to match the rest of the month-key math.
 */
export function monthProgress(today = new Date()): number {
  const y = today.getUTCFullYear();
  const m = today.getUTCMonth();
  const daysInMonth = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return today.getUTCDate() / daysInMonth;
}

export const RANGE_PRESETS = [
  "this-month",
  "last-month",
  "last-3-months",
  "ytd",
  "last-12-months",
] as const satisfies readonly RangePreset[];

const PRESET_LABELS: Record<RangePreset, string> = {
  "this-month": "This month",
  "last-month": "Last month",
  "last-3-months": "Last 3 months",
  ytd: "YTD",
  "last-12-months": "Last 12 months",
};

export function rangeLabel(preset: RangePreset): string {
  return PRESET_LABELS[preset];
}

export function isRangePreset(value: unknown): value is RangePreset {
  return typeof value === "string" && (RANGE_PRESETS as readonly string[]).includes(value);
}

/**
 * Shift a "YYYY-MM" key by `offset` months (negative to go back), e.g.
 * `shiftMonth("2026-01", -1) === "2025-12"`. JS Date normalizes month
 * overflow/underflow, so any offset is safe. The month-arithmetic primitive
 * behind `nextMonth`, the range presets, and trailing-window aggregation.
 */
export function shiftMonth(ym: string, offset: number): string {
  const [y, m] = ym.split("-").map(Number);
  // JS Date normalizes overflow/underflow in month indices, which is what we want here.
  const d = new Date(Date.UTC(y, m - 1 + offset, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Next month key, e.g. `nextMonth("2026-12") === "2027-01"`. */
export function nextMonth(ym: string): string {
  return shiftMonth(ym, 1);
}

/**
 * Maps a preset to a `[ymStart, ymEnd]` window anchored at `today`. The end
 * is always the current month — even for YTD and Last-12, the in-progress
 * month is included so KPIs update as transactions land.
 */
export function resolveRange(preset: RangePreset, today = new Date()): RangeSelection {
  const thisMonth = currentMonthKey(today);
  switch (preset) {
    case "this-month":
      return { preset, ymStart: thisMonth, ymEnd: thisMonth };
    case "last-month": {
      const last = shiftMonth(thisMonth, -1);
      return { preset, ymStart: last, ymEnd: last };
    }
    case "last-3-months":
      return { preset, ymStart: shiftMonth(thisMonth, -2), ymEnd: thisMonth };
    case "ytd":
      return { preset, ymStart: `${today.getUTCFullYear()}-01`, ymEnd: thisMonth };
    case "last-12-months":
      return { preset, ymStart: shiftMonth(thisMonth, -11), ymEnd: thisMonth };
  }
}

/**
 * A preset resolved to inclusive ISO day bounds (`YYYY-MM-DD`) — the form the
 * transaction date scope and CSV export consume. Bridges the month-key range
 * language (`resolveRange`) to the day-granular bounds the list scopes by.
 * Shared substrate for the unified date-scope control (issue #165 chunk 5) and
 * the wider-reach work on Pulse (#160) / Income (#162).
 */
export function presetDateBounds(
  preset: RangePreset,
  today = new Date(),
): { from: string; to: string } {
  const { ymStart, ymEnd } = resolveRange(preset, today);
  return { from: monthStartDate(ymStart), to: monthEndDate(ymEnd) };
}

/**
 * Inverse of {@link presetDateBounds}: given inclusive ISO day bounds, returns
 * the preset whose window matches exactly, or `null` for an arbitrary (custom)
 * range. Drives which chip the date-scope selector highlights. `today` must be
 * the same anchor the bounds were resolved against.
 */
export function presetForDateBounds(
  from: string,
  to: string,
  today = new Date(),
): RangePreset | null {
  for (const preset of RANGE_PRESETS) {
    const bounds = presetDateBounds(preset, today);
    if (bounds.from === from && bounds.to === to) return preset;
  }
  return null;
}

/**
 * Inclusive ISO day bounds for a whole calendar year (Jan 1 – Dec 31). A year
 * is just a `from`/`to` window in the same URL contract the presets and custom
 * range use — the year selector sets one of these (#160 story 1). Shared so
 * Income (#162) and Net worth inherit the same year math.
 */
export function calendarYearBounds(year: number): { from: string; to: string } {
  return { from: `${year}-01-01`, to: `${year}-12-31` };
}

/**
 * Complete past calendar years that have data, newest first — the options the
 * year selector offers (#160 story 1). Spans the year of the earliest record up
 * to last year; the current year is omitted (view it to-date with YTD, or as a
 * full year once it completes). Empty when there's no earlier year or no data,
 * which hides the selector.
 */
export function availableYears(
  earliestDate: string | undefined,
  today = new Date(),
): number[] {
  if (!earliestDate) return [];
  const firstYear = Number(earliestDate.slice(0, 4));
  const lastComplete = today.getUTCFullYear() - 1;
  if (!Number.isFinite(firstYear) || firstYear > lastComplete) return [];
  const years: number[] = [];
  for (let y = lastComplete; y >= firstYear; y--) years.push(y);
  return years;
}

/**
 * The calendar year a `[from, to]` window covers exactly (Jan 1 – Dec 31), or
 * `null` if it isn't a whole calendar year. Drives which year the selector
 * shows as active. A past-year window never coincides with a now-anchored
 * preset, so classification stays unambiguous.
 */
export function activeCalendarYear(from: string, to: string): number | null {
  const year = Number(from.slice(0, 4));
  if (!Number.isFinite(year)) return null;
  const bounds = calendarYearBounds(year);
  return from === bounds.from && to === bounds.to ? year : null;
}

export type DateScopeDescription = {
  /** Title-case caption for the page eyebrow ("This month", "2021", "All time"). */
  eyebrow: string;
  /** Lowercase phrase for inline copy — "You kept $X {phrase}." */
  phrase: string;
};

/**
 * Human labels for a resolved `[from, to]` window, so a page can caption and
 * narrate any scope the unified control produces (#160). Classifies the window
 * as a relative preset, a whole calendar year, the all-time span, or an
 * arbitrary custom range, in that order. `earliestDate` (when supplied)
 * identifies the all-time window; `today` must anchor the same bounds the
 * presets resolved against.
 */
export function describeDateScope(
  from: string,
  to: string,
  today = new Date(),
  earliestDate?: string,
): DateScopeDescription {
  const preset = presetForDateBounds(from, to, today);
  if (preset) {
    const label = rangeLabel(preset);
    return { eyebrow: label, phrase: label.toLowerCase() };
  }
  if (
    earliestDate &&
    from === earliestDate &&
    to === presetDateBounds("this-month", today).to
  ) {
    return { eyebrow: "All time", phrase: "all-time" };
  }
  const year = activeCalendarYear(from, to);
  if (year !== null) {
    return { eyebrow: String(year), phrase: `in ${year}` };
  }
  return { eyebrow: "Custom range", phrase: "in this range" };
}

/**
 * Yields every "YYYY-MM" key from `start` through `end`, inclusive. The two
 * strings are lexically comparable, which makes range checks elsewhere a
 * straight string comparison.
 */
export function* monthsInRange(start: string, end: string): Generator<string> {
  const [sy, sm] = start.split("-").map(Number);
  const [ey, em] = end.split("-").map(Number);
  let y = sy;
  let m = sm;
  while (y < ey || (y === ey && m <= em)) {
    yield `${y}-${String(m).padStart(2, "0")}`;
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }
}

/**
 * First calendar day of a "YYYY-MM" month, as ISO "YYYY-MM-DD". Bridges the
 * month-key range language (`RangeSelection`) to the ISO date bounds that the
 * transaction filter compares against — used to turn a range preset into an
 * inclusive export window.
 */
export function monthStartDate(ym: string): string {
  return `${ym}-01`;
}

/**
 * Last calendar day of a "YYYY-MM" month, as ISO "YYYY-MM-DD" — the inclusive
 * upper bound for that month. Day 0 of the next month resolves to the last day
 * of this one (28–31), so February and leap years are handled correctly.
 */
export function monthEndDate(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${ym}-${String(lastDay).padStart(2, "0")}`;
}
