import { assertValidIsoDate } from "@/lib/net-worth/validate";
import type { AccountClass, AssetKind } from "@/types/net-worth";

/**
 * Parsers for the Net Worth account / holding / check-in actions (#109 chunk 5),
 * mirroring the category/income/transaction parser pattern: each validates one
 * field and throws a user-facing message the action surfaces inline. Kept pure
 * (no DB, no session) so they unit-test without a server context. Every parser
 * takes `unknown` so it serves both `FormData.get()` (a string) and the typed
 * client payloads the fire-and-forget actions receive — a stale or hostile
 * caller is defended against at the boundary either way.
 */

function nonBlankString(raw: unknown, label: string): string {
  if (typeof raw !== "string" || raw.trim() === "") {
    throw new Error(`${label} is required`);
  }
  return raw.trim();
}

/**
 * A finite, non-negative number from a currency-ish string ("$4,200.50") or a
 * bare number (typed payloads send numbers). Zero is allowed — a cash account
 * can legitimately hold $0, unlike a transaction amount. Balances and share
 * quantities are magnitudes; an account's class supplies the sign downstream.
 */
function finiteNonNegative(raw: unknown, label: string): number {
  let n: number;
  if (typeof raw === "number") {
    n = raw;
  } else if (typeof raw === "string" && raw.trim() !== "") {
    const cleaned = raw.replace(/[^0-9.\-]/g, "");
    if (cleaned === "" || !/[0-9]/.test(cleaned)) {
      throw new Error(`${label} must be a number`);
    }
    n = Number(cleaned);
  } else {
    throw new Error(`${label} is required`);
  }
  if (!Number.isFinite(n)) {
    throw new Error(`${label} must be a number`);
  }
  if (n < 0) {
    throw new Error(`${label} must not be negative`);
  }
  return n;
}

/** The account's display name — non-blank after trimming. */
export function parseAccountName(raw: unknown): string {
  return nonBlankString(raw, "Account name");
}

/** An account/holding id a mutation targets. */
export function parseAccountId(raw: unknown): string {
  return nonBlankString(raw, "Account id");
}

/** Asset or liability — the two account classes (ADR 0003). */
export function parseAccountClass(raw: unknown): AccountClass {
  if (raw === "asset" || raw === "liability") return raw;
  throw new Error("Choose a class: asset or liability");
}

/**
 * The kind of an asset account. Only meaningful for assets — a liability carries
 * no kind (the caller only parses this when `class === "asset"`).
 */
export function parseAssetKind(raw: unknown): AssetKind {
  if (raw === "cash" || raw === "investment" || raw === "property") return raw;
  throw new Error("Choose a kind: cash, investment, or property");
}

/** A manual balance for a cash / property / liability account (magnitude, ≥ 0). */
export function parseBalanceAmount(raw: unknown): number {
  return finiteNonNegative(raw, "Balance");
}

/**
 * A ticker symbol, upper-cased so it keys the app-global quote cache
 * consistently ("aapl" and "AAPL" are one symbol). Non-blank after trimming.
 */
export function parseTicker(raw: unknown): string {
  return nonBlankString(raw, "Ticker").toUpperCase();
}

/** A share quantity — a plain non-negative decimal (story 23), ≥ 0. */
export function parseQuantity(raw: unknown): number {
  return finiteNonNegative(raw, "Quantity");
}

/**
 * The optional manual price override on a holding (story 12). An empty / absent
 * field means "use the feed price" → `undefined`; a present value must be a
 * non-negative number.
 */
export function parsePriceOverride(raw: unknown): number | undefined {
  if (raw === undefined || raw === null || (typeof raw === "string" && raw.trim() === "")) {
    return undefined;
  }
  return finiteNonNegative(raw, "Price override");
}

/**
 * The date a check-in / close is recorded under. Optional — an absent value
 * means "today" (the action supplies it); a present value must be a real ISO
 * calendar date, reusing the same guard the snapshot write boundary enforces.
 */
export function parseCheckInDate(raw: unknown): string | undefined {
  if (raw === undefined || raw === null || (typeof raw === "string" && raw.trim() === "")) {
    return undefined;
  }
  const date = nonBlankString(raw, "Date");
  assertValidIsoDate(date);
  return date;
}
