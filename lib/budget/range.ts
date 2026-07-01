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

function shiftMonth(ym: string, offset: number): string {
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
