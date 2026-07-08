/**
 * Money conversion for the importer. Amounts are carried as **signed integer
 * cents** through parsing and reconciliation so that summing a cell's itemized
 * lines against its checksum is exact — binary floats drift once you add a few
 * hundred `x.xx` dollar values. Dollars (the app's `Transaction.amount` unit)
 * are produced only at the document boundary via {@link centsToDollars}.
 */

/**
 * Parse a plain money magnitude — digits, optional thousands commas, optional
 * up to two decimal places, no sign and no `$` — into integer cents. The caller
 * (the line parser) has already stripped the `$`, sign, and any wrapper parens.
 *
 * `"1,234"` → `123400`, `"1234.5"` → `123450`, `"1234.56"` → `123456`.
 * Throws on anything that isn't a bare magnitude, so a malformed amount fails
 * loudly at parse time rather than silently reconciling wrong.
 */
export function parseAmountToCents(magnitude: string): number {
  const cleaned = magnitude.replace(/,/g, "").trim();
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) {
    throw new Error(`Not a money magnitude: ${JSON.stringify(magnitude)}`);
  }
  const [intPart, fracPart = ""] = cleaned.split(".");
  const frac = (fracPart + "00").slice(0, 2);
  return Number(intPart) * 100 + Number(frac);
}

/** Integer cents → a dollars number for `Transaction.amount` (`123450` → `1234.5`). */
export function centsToDollars(cents: number): number {
  return cents / 100;
}
