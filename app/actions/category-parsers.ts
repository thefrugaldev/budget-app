import type { CategoryKind } from "@/types/budget";

/**
 * Parses a positive monthly target amount entered into the category form.
 * Accepts currency-formatted strings (`"$800"`, `"$ 800.50"`) and bare
 * numerics. Throws on empty input, non-numeric text, or negative values so
 * the calling action surfaces an inline error. Zero is permitted — a $0
 * target is a valid "track but no cap" configuration.
 */
export function parseMonthlyTarget(raw: FormDataEntryValue | null): number {
  if (typeof raw !== "string" || raw.trim() === "") {
    throw new Error("Monthly target is required");
  }
  const cleaned = raw.replace(/[^0-9.\-]/g, "");
  if (cleaned === "" || !/[0-9]/.test(cleaned)) {
    throw new Error("Monthly target must be a number");
  }
  const n = Number(cleaned);
  if (!Number.isFinite(n)) {
    throw new Error("Monthly target must be a number");
  }
  if (n < 0) {
    throw new Error("Monthly target cannot be negative");
  }
  return n;
}

const KINDS: readonly CategoryKind[] = ["expense", "savings", "income"];

export function parseCategoryKind(raw: FormDataEntryValue | null): CategoryKind {
  if (typeof raw !== "string" || raw.trim() === "") {
    throw new Error("Category kind is required");
  }
  const trimmed = raw.trim();
  if (!(KINDS as readonly string[]).includes(trimmed)) {
    throw new Error("Category kind must be expense, savings, or income");
  }
  return trimmed as CategoryKind;
}

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

export function parseMonthKey(
  raw: FormDataEntryValue | null,
  field: string,
): string {
  if (typeof raw !== "string" || raw.trim() === "") {
    throw new Error(`${field} is required`);
  }
  const trimmed = raw.trim();
  if (!MONTH_RE.test(trimmed)) {
    throw new Error(`${field} must look like YYYY-MM`);
  }
  return trimmed;
}

export function parseOptionalMonthKey(
  raw: FormDataEntryValue | null,
  field: string,
): string | undefined {
  if (raw === null) return undefined;
  if (typeof raw !== "string" || raw.trim() === "") return undefined;
  return parseMonthKey(raw, field);
}
