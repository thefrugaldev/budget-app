import type { FireAssumptionOverrides } from "@/types/fire";

/**
 * Parsers for the FIRE assumptions action (#110 chunk 3), mirroring the
 * net-worth / category parser pattern: each validates one knob and throws a
 * user-facing message the action surfaces inline. Kept pure (no DB, no session)
 * so they unit-test without a server context.
 *
 * Every knob is **optional** here: a blank / absent field means "not overridden"
 * → `undefined`, so the knob tracks its data-derived or constant default at
 * resolution. A present value is validated. That distinction is load-bearing — a
 * blank field un-overrides a knob, while an explicit `0` is a deliberate value
 * (zero contribution is the coast case, story 10).
 */

/** True for the empty / absent field that means "not overridden". */
function isBlank(raw: unknown): boolean {
  return raw === undefined || raw === null || (typeof raw === "string" && raw.trim() === "");
}

/**
 * Coerce a field to a finite number, or `undefined` when it's blank or not a
 * shape we accept. **Shared with the client live preview** (`FireDashboard`): the
 * server turns `undefined` into a thrown "must be a number", the client treats it
 * as "not overridden", so both agree on exactly which inputs are valid — the
 * panel never previews a value the Save then rejects (nor vice-versa).
 *
 * Accepts a bare number, or a currency/percent-ish string ("$4,200.50", "5%")
 * after stripping `$ , %` and whitespace, then a whitelisted decimal shape ("3",
 * "3.5", "3.", ".5"). Odd shapes ("1e5", "1.2.3") coerce to `undefined` rather
 * than silently becoming a wrong number.
 */
export function coerceNumber(raw: unknown): number | undefined {
  let n: number;
  if (typeof raw === "number") {
    n = raw;
  } else if (typeof raw === "string" && raw.trim() !== "") {
    const stripped = raw.replace(/[$,%\s]/g, "");
    if (!/^-?(\d+(\.\d*)?|\.\d+)$/.test(stripped)) return undefined;
    n = Number(stripped);
  } else {
    return undefined;
  }
  return Number.isFinite(n) ? n : undefined;
}

/** A finite number in `[min, max]` (optionally integer), throwing a field-labeled message otherwise. */
function parseNumber(
  raw: unknown,
  label: string,
  { min, max, integer = false }: { min: number; max: number; integer?: boolean },
): number {
  const n = coerceNumber(raw);
  if (n === undefined) throw new Error(`${label} must be a number`);
  if (integer && !Number.isInteger(n)) throw new Error(`${label} must be a whole number`);
  if (n < min || n > max) throw new Error(`${label} must be between ${min} and ${max}`);
  return n;
}

/** Monthly retirement spend override (story 9), today's dollars — non-negative. */
export function parseMonthlyRetirementSpend(raw: unknown): number | undefined {
  if (isBlank(raw)) return undefined;
  return parseNumber(raw, "Retirement spend", { min: 0, max: 100_000_000 });
}

/** Monthly contribution override (story 10) — non-negative; `0` is the coast case. */
export function parseMonthlyContribution(raw: unknown): number | undefined {
  if (isBlank(raw)) return undefined;
  return parseNumber(raw, "Monthly contribution", { min: 0, max: 100_000_000 });
}

/** Expected nominal annual return, percent (story 11) — 0–100. */
export function parseNominalReturn(raw: unknown): number | undefined {
  if (isBlank(raw)) return undefined;
  return parseNumber(raw, "Nominal return", { min: 0, max: 100 });
}

/** Expected annual inflation, percent (story 11) — 0–100. */
export function parseInflation(raw: unknown): number | undefined {
  if (isBlank(raw)) return undefined;
  return parseNumber(raw, "Inflation", { min: 0, max: 100 });
}

/**
 * Safe withdrawal rate, percent (story 12) — must be **positive** (a rate of 0
 * has no finite FIRE number) and ≤ 100.
 */
export function parseSafeWithdrawalRate(raw: unknown): number | undefined {
  if (isBlank(raw)) return undefined;
  const swr = parseNumber(raw, "Safe withdrawal rate", { min: 0, max: 100 });
  if (swr === 0) throw new Error("Safe withdrawal rate must be greater than 0");
  return swr;
}

/**
 * Birth year (story 13) — a four-digit year no later than this year and no
 * earlier than 1900. Rejects a future or absurdly old year that would produce a
 * nonsense age/coast horizon. `currentYear` is injectable for deterministic tests.
 */
export function parseBirthYear(
  raw: unknown,
  currentYear = new Date().getUTCFullYear(),
): number | undefined {
  if (isBlank(raw)) return undefined;
  return parseNumber(raw, "Birth year", { min: 1900, max: currentYear, integer: true });
}

/** Traditional retirement age (story 13), default 65 — a plausible whole age. */
export function parseTraditionalRetirementAge(raw: unknown): number | undefined {
  if (isBlank(raw)) return undefined;
  return parseNumber(raw, "Retirement age", { min: 1, max: 120, integer: true });
}

/**
 * Build the full override set from a form's fields (#110 chunk 3). Each knob is
 * parsed independently; only the ones the user filled in appear in the result, so
 * the persisted set is exactly the overrides (the repository unsets the rest).
 * `currentYear` flows through to the birth-year bound for testability.
 */
export function parseAssumptionOverrides(
  get: (name: string) => unknown,
  currentYear = new Date().getUTCFullYear(),
): FireAssumptionOverrides {
  // Assemble directly: a blank knob parses to `undefined` and is simply not added,
  // so the result is exactly the user's overrides (no build-then-filter pass).
  const overrides: FireAssumptionOverrides = {};
  const spend = parseMonthlyRetirementSpend(get("monthlyRetirementSpend"));
  if (spend !== undefined) overrides.monthlyRetirementSpend = spend;
  const contribution = parseMonthlyContribution(get("monthlyContribution"));
  if (contribution !== undefined) overrides.monthlyContribution = contribution;
  const nominalReturn = parseNominalReturn(get("nominalReturn"));
  if (nominalReturn !== undefined) overrides.nominalReturn = nominalReturn;
  const inflation = parseInflation(get("inflation"));
  if (inflation !== undefined) overrides.inflation = inflation;
  const swr = parseSafeWithdrawalRate(get("safeWithdrawalRate"));
  if (swr !== undefined) overrides.safeWithdrawalRate = swr;
  const birthYear = parseBirthYear(get("birthYear"), currentYear);
  if (birthYear !== undefined) overrides.birthYear = birthYear;
  const retirementAge = parseTraditionalRetirementAge(get("traditionalRetirementAge"));
  if (retirementAge !== undefined) overrides.traditionalRetirementAge = retirementAge;
  return overrides;
}
