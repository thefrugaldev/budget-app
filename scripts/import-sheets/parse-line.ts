import { parseAmountToCents } from "./money";
import type { ParsedLine } from "./types";

/**
 * Parse one workbook comment line into a structured transaction (ADR 0005
 * decision 1: comments are the transaction source of truth). The canonical
 * shape is `M/D - $Amount (Vendor - Note)`; the parser also handles the
 * variants observed across 2020–2026:
 *
 * - vendor only — `4/3 - $52.10 (Costco)`
 * - vendor + note, split on the first ` - ` inside the parens —
 *   `4/3 - $52.10 (Costco - household)`
 * - no parens (vendor omitted) — `4/3 - $1,240.00`
 * - thousands separators and 0–2 decimal places — `$9,999`, `$9.9`, `$12.34`
 * - **refund / negative**, minus *inside* the parens — `4/3 - (-$52.10) (Costco)`
 *   → negative `amountCents` (NOT the accounting `($x)` convention)
 *
 * A line with no leading `M/D - ` or no `$Amount` (a free-text note) returns
 * `{ kind: "unparsed" }` rather than throwing — extract surfaces those for
 * review, and the reconciliation gate decides whether the cell still balances.
 * Whitespace around every part is tolerated and trimmed.
 */
export function parseCommentLine(raw: string): ParsedLine {
  const unparsed = { kind: "unparsed", raw } as const;
  const trimmed = raw.trim();

  // Leading date and the "- " separator before the amount.
  const dateMatch = /^(\d{1,2})\/(\d{1,2})\s*-\s*(.*)$/.exec(trimmed);
  if (!dateMatch) return unparsed;

  const month = Number(dateMatch[1]);
  const day = Number(dateMatch[2]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return unparsed;

  const rest = dateMatch[3];

  // The remainder is the amount followed by an optional `(Vendor - Note)` group
  // and nothing else. Two anchored branches so the refund wrapper's `(-` and
  // `)` are all-or-nothing: an unbalanced `(-$5.00` or `$5.00)` matches neither
  // and falls to `unparsed` rather than silently mis-signing or swallowing junk.
  const MAGNITUDE = String.raw`[\d,]+(?:\.\d{1,2})?`;
  const PARENS = String.raw`(?:\s*\((.*)\))?`;
  const negativeMatch = new RegExp(
    `^\\(-\\s*\\$\\s*(${MAGNITUDE})\\s*\\)${PARENS}\\s*$`,
  ).exec(rest);
  const positiveMatch =
    negativeMatch ?? new RegExp(`^\\$\\s*(${MAGNITUDE})${PARENS}\\s*$`).exec(rest);
  if (!positiveMatch) return unparsed;

  const negative = negativeMatch !== null;
  const magnitude = positiveMatch[1];
  const parenBody = positiveMatch[2] ?? null;

  let amountCents: number;
  try {
    amountCents = parseAmountToCents(magnitude);
  } catch {
    return unparsed;
  }
  if (negative) amountCents = -amountCents;

  const { vendor, note } = parseVendorNote(parenBody);

  return { kind: "transaction", month, day, amountCents, vendor, note };
}

/**
 * Split the `(Vendor - Note)` body (already unwrapped from its parens by the
 * caller, or `null` when the line had none). The vendor and note divide on the
 * *first* ` - ` only, so a note may itself contain " - "; an absent or empty
 * body yields two nulls.
 */
function parseVendorNote(body: string | null): {
  vendor: string | null;
  note: string | null;
} {
  const inner = body?.trim() ?? "";
  if (inner === "") return { vendor: null, note: null };

  const sep = inner.indexOf(" - ");
  if (sep === -1) return { vendor: inner, note: null };

  const vendor = inner.slice(0, sep).trim();
  const note = inner.slice(sep + 3).trim();
  return { vendor: vendor || null, note: note || null };
}
