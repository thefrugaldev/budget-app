/**
 * Currency and date-label formatting for budget surfaces. Pure presentation
 * helpers — no domain logic. All date formatting is pinned to UTC so server
 * and client render identical strings regardless of the runtime timezone.
 */

export function fmt(amount: number): string {
  return amount.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    // Whole dollars once the *magnitude* clears $100, cents below it — keyed on
    // the absolute value so a negative (a liability, a refund) rounds the same as
    // its positive twin. Without the `abs`, every negative fell under the `< 100`
    // branch and rendered cents ("-$300,000.00" beside a clean "$549,341").
    maximumFractionDigits: Math.abs(amount) >= 100 ? 0 : 2,
  });
}

export function fmtExact(amount: number): string {
  return amount.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

/**
 * Compact currency for tight spaces — `"$210k"`, `"$1.2M"`. The chart value-axis
 * gutter's format (shared by the line/area charts) where the exact figure lives
 * in the tooltip / data table instead. Keep the exact `fmt` for anywhere a
 * precise amount matters.
 */
export function fmtCompact(amount: number): string {
  return amount.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  });
}

export function dayLabel(iso: string, today = new Date()): string {
  const todayIso = today.toISOString().slice(0, 10);
  if (iso === todayIso) return "Today";
  const y = new Date(today);
  y.setUTCDate(today.getUTCDate() - 1);
  if (iso === y.toISOString().slice(0, 10)) return "Yesterday";
  return new Date(iso + "T00:00:00Z").toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

/**
 * Full calendar date for a "YYYY-MM-DD" string, e.g. `"May 15, 2026"`. Used for
 * the one-time income card's last-receipt line. UTC-pinned like the other date
 * helpers so server and client render identically.
 */
export function longDateLabel(iso: string): string {
  return new Date(iso + "T00:00:00Z").toLocaleString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function monthLabel(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function monthLabelShort(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleString("en-US", { month: "short", timeZone: "UTC" });
}

/** Abbreviated month with year, e.g. `"2026-09"` → `"Sep 2026"` — compact enough
 * for an inline chip where the full `monthLabel` ("September 2026") is too long. */
export function monthShortYear(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleString("en-US", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

/**
 * Compact label for an inclusive `[startYm, endYm]` month span — the caption the
 * Growth Columns wear so the chart always states the window it plots (#160).
 * A single month reads as `"Aug 2026"`; a same-year span drops the repeated year
 * (`"Jan–Dec 2023"`); a cross-year span carries the year on both ends
 * (`"Mar 2025 – Aug 2026"`). Assumes `startYm <= endYm` (lexical, as the month
 * keys are). UTC-pinned via the month helpers it composes.
 */
export function formatMonthSpan(startYm: string, endYm: string): string {
  if (startYm === endYm) return monthShortYear(startYm);
  const sameYear = startYm.slice(0, 4) === endYm.slice(0, 4);
  if (sameYear) {
    return `${monthLabelShort(startYm)}–${monthLabelShort(endYm)} ${endYm.slice(0, 4)}`;
  }
  return `${monthShortYear(startYm)} – ${monthShortYear(endYm)}`;
}
