/**
 * Currency and date-label formatting for budget surfaces. Pure presentation
 * helpers — no domain logic. All date formatting is pinned to UTC so server
 * and client render identical strings regardless of the runtime timezone.
 */

export function fmt(amount: number): string {
  return amount.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: amount >= 100 ? 0 : 2,
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
