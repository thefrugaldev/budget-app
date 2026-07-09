import type {
  LineOverride,
  ParsedTransactionLine,
  ReconcileResult,
} from "./types";

/**
 * The reconciliation gate (ADR 0005 decision 1): a cell's itemized comment
 * lines must sum *exactly* to the cell's own value, or the divergence must be
 * explained by an explicit override — never left silent. This is a pure
 * verdict over already-parsed lines; extract wires an `"unreconciled"` result
 * to a hard failure.
 *
 * Resolution order:
 *   1. **Explicit overrides** (from `overrides.json`) apply first — `skip`
 *      removes a line, `sign-flip`/`set-amount` correct it. (`set-date` doesn't
 *      touch the checksum and is ignored here.)
 *   2. If the lines now sum to the cell, the cell is `"exact"`.
 *   3. Otherwise the **conditional keyword sign-flip** is attempted: every
 *      remaining positive line whose vendor/note matches a refund keyword is
 *      flipped together, and the flip is accepted *only if it makes the cell
 *      reconcile exactly* (ADR: "sign-flips accepted only when they make the
 *      cell reconcile exactly"). This captures pre-2022 refunds keyed in as
 *      positive amounts without hand-writing an override for each.
 *   4. Otherwise the cell is `"unreconciled"`, with the raw delta reported.
 *
 * `line` numbers in overrides are 1-based positions within the cell (the
 * `#line` of the line's importRef).
 */
export function reconcileCell(input: {
  cellValueCents: number;
  lines: ParsedTransactionLine[];
  overrides?: LineOverride[];
  refundKeywords?: string[];
}): ReconcileResult {
  const { cellValueCents, lines, overrides = [], refundKeywords = [] } = input;

  const overrideByLine = new Map<number, LineOverride>();
  for (const o of overrides) overrideByLine.set(o.line, o);

  // Apply explicit overrides, dropping skipped lines but remembering each
  // survivor's original 1-based index for keyword-flip reporting.
  const working: { index: number; line: ParsedTransactionLine }[] = [];
  lines.forEach((line, i) => {
    const override = overrideByLine.get(i + 1);
    if (override?.action === "skip") return;

    let amountCents = line.amountCents;
    if (override?.action === "sign-flip") amountCents = -amountCents;
    else if (override?.action === "set-amount") amountCents = override.amountCents;

    working.push({ index: i + 1, line: { ...line, amountCents } });
  });

  const sumOf = (rows: typeof working) =>
    rows.reduce((acc, r) => acc + r.line.amountCents, 0);

  const baseSum = sumOf(working);
  if (baseSum === cellValueCents) {
    return result("exact", working, [], cellValueCents, baseSum, 0);
  }

  // Conditional keyword sign-flip.
  const keywords = refundKeywords.map((k) => k.toLowerCase()).filter(Boolean);
  const flippable = working.filter(
    (r) => r.line.amountCents > 0 && matchesKeyword(r.line, keywords),
  );
  if (flippable.length > 0) {
    const flippedIndices = new Set(flippable.map((r) => r.index));
    const flipped = working.map((r) =>
      flippedIndices.has(r.index)
        ? { ...r, line: { ...r.line, amountCents: -r.line.amountCents } }
        : r,
    );
    if (sumOf(flipped) === cellValueCents) {
      return result(
        "reconciled-by-flip",
        flipped,
        [...flippedIndices].sort((a, b) => a - b),
        cellValueCents,
        cellValueCents,
        0,
      );
    }
  }

  return result(
    "unreconciled",
    working,
    [],
    cellValueCents,
    baseSum,
    baseSum - cellValueCents,
  );
}

function matchesKeyword(
  line: ParsedTransactionLine,
  keywords: string[],
): boolean {
  if (keywords.length === 0) return false;
  const hay = `${line.vendor ?? ""} ${line.note ?? ""}`.toLowerCase();
  return keywords.some((k) => hay.includes(k));
}

function result(
  status: ReconcileResult["status"],
  working: { index: number; line: ParsedTransactionLine }[],
  autoFlippedLines: number[],
  cellValueCents: number,
  sumCents: number,
  deltaCents: number,
): ReconcileResult {
  return {
    status,
    cellValueCents,
    sumCents,
    deltaCents,
    effectiveLines: working.map((r) => ({ ...r.line, line: r.index })),
    autoFlippedLines,
  };
}
