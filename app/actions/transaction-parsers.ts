/**
 * Parses a user-entered positive amount. The transaction form's amount input
 * is positive-only — sign is set by a separate segmented control and applied
 * at submit. Empty, non-numeric, zero, and negative values throw so the
 * server action surfaces an inline error.
 */
export function parsePositiveAmount(raw: FormDataEntryValue | null): number {
  if (typeof raw !== "string" || raw.trim() === "") {
    throw new Error("Amount is required");
  }
  const cleaned = raw.replace(/[^0-9.\-]/g, "");
  if (cleaned === "" || !/[0-9]/.test(cleaned)) {
    throw new Error("Amount must be a number");
  }
  const n = Number(cleaned);
  if (!Number.isFinite(n)) {
    throw new Error("Amount must be a number");
  }
  if (n <= 0) {
    throw new Error("Amount must be greater than zero");
  }
  return n;
}

/**
 * Combines the positive amount with the segmented sign control. The form
 * always submits `sign` as one of these two literals, but a hostile or
 * stale client could omit it — fall back to "+" so the worst case is a
 * mistakenly-positive transaction the user can edit, not a 500 response.
 */
export function applySign(amount: number, raw: FormDataEntryValue | null): number {
  return raw === "-" ? -amount : amount;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function parseIsoDate(raw: FormDataEntryValue | null): string {
  if (typeof raw !== "string" || !ISO_DATE.test(raw)) {
    throw new Error("Date is required (YYYY-MM-DD)");
  }
  return raw;
}

/** Upper bound on a single bulk operation's id list (see parseTransactionIds). */
const MAX_BULK_IDS = 5000;

/**
 * Validates the transaction-id list a bulk action (delete / recategorise /
 * vendor rename) operates on. The list arrives as a typed array from the
 * client rather than FormData, but a stale or hostile caller could send
 * garbage, so we defend at the action boundary: the value must be a non-empty
 * array, every entry a non-empty string. Trims and de-duplicates so a repeated
 * id can't inflate a "12 transactions" confirmation.
 */
export function parseTransactionIds(raw: unknown): string[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new Error("Select at least one transaction");
  }
  // Hard cap well above any realistic UI selection — bounds the `$in` query and
  // the de-dupe loop so a buggy or hostile client can't send a 10^6-id array.
  if (raw.length > MAX_BULK_IDS) {
    throw new Error("Too many transactions selected");
  }
  const seen = new Set<string>();
  for (const entry of raw) {
    if (typeof entry !== "string" || entry.trim() === "") {
      throw new Error("Invalid transaction id");
    }
    seen.add(entry.trim());
  }
  return [...seen];
}

/**
 * Validates the new vendor name for a bulk rename. Non-empty after trimming;
 * the trimmed value is what gets written so a stray space can't create a
 * near-duplicate vendor. (Vendor canonicalisation across spellings stays out
 * of scope per the PRD.)
 */
export function parseVendorName(raw: unknown): string {
  if (typeof raw !== "string" || raw.trim() === "") {
    throw new Error("Vendor name is required");
  }
  return raw.trim();
}
