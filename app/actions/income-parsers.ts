import type { IncomeFrequency, PayCadence } from "@/types/budget";

import { parseMonthKey } from "./category-parsers";

const PAY_CADENCES: readonly PayCadence[] = [
  "weekly",
  "bi-weekly",
  "semi-monthly",
  "monthly",
];

/**
 * Parses a user-entered positive currency amount under a caller-supplied
 * `label` (which drives the error copy, e.g. "Yearly amount", "Amount per
 * paycheck"). Accepts currency-formatted strings (`"$90,000"`, `"$ 90,000.50"`)
 * and bare numerics. Throws on empty input, non-numeric text, or non-positive
 * values so the calling action surfaces an inline error.
 */
export function parsePositiveAmount(
  raw: FormDataEntryValue | null,
  label: string,
): number {
  if (typeof raw !== "string" || raw.trim() === "") {
    throw new Error(`${label} is required`);
  }
  const cleaned = raw.replace(/[^0-9.\-]/g, "");
  // `Number("")` === 0; treat empty-after-stripping as "no digits" so non-
  // numeric input like "abc" rejects with the right message, not "≤ 0".
  if (cleaned === "" || !/[0-9]/.test(cleaned)) {
    throw new Error(`${label} must be a number`);
  }
  const n = Number(cleaned);
  if (!Number.isFinite(n)) {
    throw new Error(`${label} must be a number`);
  }
  if (n <= 0) {
    throw new Error(`${label} must be greater than zero`);
  }
  return n;
}

/** Yearly baseline amount (inline editor + legacy create path). */
export function parseYearly(raw: FormDataEntryValue | null): number {
  return parsePositiveAmount(raw, "Yearly amount");
}

/** Per-paycheck amount entered for a recurring source's cadence (story 3). */
export function parsePerPaycheck(raw: FormDataEntryValue | null): number {
  return parsePositiveAmount(raw, "Amount per paycheck");
}

/** Step-1 frequency discriminator from the two-step Add Source form. */
export function parseIncomeFrequency(
  raw: FormDataEntryValue | null,
): IncomeFrequency {
  if (raw === "recurring" || raw === "one-time") return raw;
  throw new Error("Choose whether this income is recurring or one-time");
}

/** Pay cadence for a recurring source. */
export function parsePayCadence(raw: FormDataEntryValue | null): PayCadence {
  if (typeof raw === "string" && PAY_CADENCES.includes(raw as PayCadence)) {
    return raw as PayCadence;
  }
  throw new Error("Pick a pay cadence");
}

/**
 * Parses the FormData submitted to `cancelScheduledBaselineAction`. Validates
 * the `(categoryId, effectiveFrom)` pair shape only — the action layer is
 * responsible for the "effectiveFrom must be in the future" business rule,
 * since it depends on the clock.
 */
export function parseCancelScheduledBaselineInput(formData: FormData): {
  categoryId: string;
  effectiveFrom: string;
} {
  const rawId = formData.get("categoryId");
  if (typeof rawId !== "string" || rawId.trim() === "") {
    throw new Error("categoryId is required");
  }
  return {
    categoryId: rawId.trim(),
    effectiveFrom: parseMonthKey(formData.get("effectiveFrom"), "Effective from"),
  };
}
