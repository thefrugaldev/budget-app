/**
 * Currency-amount entry helpers for the `AmountInput` control. The form state
 * holds a canonical decimal-dollar string (`"1234.5"`, `"85000"` — what the
 * server parsers accept); these helpers sanitise keystrokes into that canonical
 * form and format it for display with live comma grouping.
 *
 * Two precisions:
 *   - "cents" — explicit decimal: digits are dollars, you type the `.` yourself
 *     for cents (`1234` → `$1,234`, then `.56` → `$1,234.56`). Integer part is
 *     comma-grouped as you go. For transactions, savings, per-paycheck income.
 *   - "whole" — integer dollars only, comma-grouped, no decimal accepted
 *     (`85000` → `$85,000`). For income baselines where cents are noise.
 */

export type AmountPrecision = "cents" | "whole";

const DEFAULT_MAX_INT_DIGITS = 9;

/**
 * Reduce raw input (a keystroke result or formatted display value) to the
 * canonical numeric string: digits, an optional single `.`, at most two
 * decimals in "cents"; integer-only in "whole". Strips `$`, commas, leading
 * zeros, and bounds the integer part by `maxIntDigits`. A bare/trailing `.` is
 * preserved while typing so the user can continue into the cents.
 */
export function sanitizeAmount(
  input: string,
  precision: AmountPrecision,
  maxIntDigits = DEFAULT_MAX_INT_DIGITS,
): string {
  const stripped = input.replace(/[^0-9.]/g, "");

  if (precision === "whole") {
    // Drop the fractional part rather than concatenating digits across the dot,
    // so "85000.49" reads as 85,000 (and a pasted "$85,000.49" loses the cents)
    // instead of becoming 8,500,049.
    return trimInt(stripped.split(".")[0], maxIntDigits);
  }

  const firstDot = stripped.indexOf(".");
  if (firstDot === -1) return trimInt(stripped, maxIntDigits);

  const intPart = trimInt(stripped.slice(0, firstDot), maxIntDigits) || "0";
  const decPart = stripped.slice(firstDot + 1).replace(/\./g, "").slice(0, 2);
  return `${intPart}.${decPart}`;
}

function trimInt(digits: string, maxIntDigits: number): string {
  return digits.replace(/^0+(?=\d)/, "").slice(0, maxIntDigits);
}

/**
 * Format a canonical string for display — `$` prefix and comma-grouped integer
 * part, showing exactly the decimals typed so far (a trailing `.` stays
 * visible). Empty for an empty value so the placeholder shows.
 */
export function formatAmount(canonical: string, precision: AmountPrecision): string {
  if (canonical === "") return "";

  if (precision === "whole") {
    const n = canonical.replace(/\D/g, "");
    return n === "" ? "" : `$${Number(n).toLocaleString("en-US")}`;
  }

  const dot = canonical.indexOf(".");
  if (dot === -1) {
    return `$${Number(canonical).toLocaleString("en-US")}`;
  }
  const intPart = canonical.slice(0, dot) || "0";
  const decPart = canonical.slice(dot + 1);
  return `$${Number(intPart).toLocaleString("en-US")}.${decPart}`;
}

/**
 * Split the formatted value into a dollars segment (`"$1,234"`) and a cents
 * segment that includes the leading dot (`".50"`, or `"."` mid-type, or `null`
 * when no decimal was entered). Lets the display render the cents smaller and
 * lighter as a visual cue. `dollars` is `""` for an empty value.
 */
export function formatAmountParts(
  value: string,
  precision: AmountPrecision,
): { dollars: string; cents: string | null } {
  const f = formatAmount(value, precision);
  if (f === "") return { dollars: "", cents: null };
  const dot = f.indexOf(".");
  if (dot === -1) return { dollars: f, cents: null };
  return { dollars: f.slice(0, dot), cents: f.slice(dot) };
}

/**
 * Normalise a canonical string when the field loses focus: drop a lone trailing
 * `.`, and pad the cents to two digits when a decimal was entered. Whole-dollar
 * cents entries are left clean (`"1234"` stays `"1234"`, not `"1234.00"`).
 */
export function padOnBlur(canonical: string, precision: AmountPrecision): string {
  if (precision === "whole" || canonical === "") return canonical;
  const dot = canonical.indexOf(".");
  if (dot === -1) return canonical;
  const intPart = canonical.slice(0, dot) || "0";
  const decPart = canonical.slice(dot + 1);
  if (decPart === "") return intPart; // lone trailing dot -> whole dollars
  return `${intPart}.${decPart.padEnd(2, "0")}`;
}
