/**
 * Form-data parsers for the Target-suggestion accept/dismiss actions (#186
 * chunk 4). Unlike the category/income parsers these don't validate free text —
 * every numeric field is a hidden value serialized from a `TargetSuggestion`
 * the server itself produced, so the job is to reject a forged or garbled post,
 * not to guide a typing user. Extracted and tested so the actions stay thin,
 * matching the other `*-parsers` files.
 */

export function parseCategoryId(raw: FormDataEntryValue | null): string {
  if (typeof raw !== "string" || raw.trim() === "") {
    throw new Error("categoryId is required");
  }
  return raw.trim();
}

/**
 * A non-negative money amount carried on a suggestion (the proposed Target, the
 * observed median, or the current Target it was measured against). Values are
 * plain numeric strings from hidden inputs, so a bare `Number` parse is enough —
 * no currency-symbol stripping like the human-facing `parseMonthlyTarget`. A
 * negative is a garbled post and throws.
 *
 * Zero is permitted by default (a `dismissedMedian` could legitimately be 0),
 * but pass `allowZero: false` where 0 is nonsensical — the accepted
 * `proposedTarget` is never legitimately 0, so a forged 0 there would write a
 * `$0` (unbudgeted) cap and should be rejected.
 */
export function parseSuggestionAmount(
  raw: FormDataEntryValue | null,
  field: string,
  { allowZero = true }: { allowZero?: boolean } = {},
): number {
  if (typeof raw !== "string" || raw.trim() === "") {
    throw new Error(`${field} is required`);
  }
  const n = Number(raw.trim());
  if (!Number.isFinite(n)) {
    throw new Error(`${field} must be a number`);
  }
  if (n < 0) {
    throw new Error(`${field} cannot be negative`);
  }
  if (n === 0 && !allowZero) {
    throw new Error(`${field} must be greater than 0`);
  }
  return n;
}
