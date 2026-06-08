/**
 * Parses a user-entered yearly amount. Accepts currency-formatted strings
 * (`"$90,000"`, `"$ 90,000.50"`) and bare numerics. Throws on empty input,
 * non-numeric text, or non-positive values so the calling action surfaces an
 * inline error.
 */
export function parseYearly(raw: FormDataEntryValue | null): number {
  if (typeof raw !== "string" || raw.trim() === "") {
    throw new Error("Yearly amount is required");
  }
  const cleaned = raw.replace(/[^0-9.\-]/g, "");
  // `Number("")` === 0; treat empty-after-stripping as "no digits" so non-
  // numeric input like "abc" rejects with the right message, not "≤ 0".
  if (cleaned === "" || !/[0-9]/.test(cleaned)) {
    throw new Error("Yearly amount must be a number");
  }
  const n = Number(cleaned);
  if (!Number.isFinite(n)) {
    throw new Error("Yearly amount must be a number");
  }
  if (n <= 0) {
    throw new Error("Yearly amount must be greater than zero");
  }
  return n;
}
