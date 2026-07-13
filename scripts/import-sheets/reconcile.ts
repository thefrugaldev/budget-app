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
 *      removes a line, `sign-flip`/`set-amount` correct it, `add-line` appends
 *      a synthetic line the parser can't produce (unparseable comment shapes,
 *      unitemized remainders). (`set-date` doesn't touch the checksum and is
 *      ignored here.) Added lines join the sum before step 2.
 *   2. If the lines now sum to the cell, the cell is `"exact"`.
 *   3. Otherwise the **conditional keyword sign-flip** is attempted: every
 *      remaining positive line whose vendor/note matches a refund keyword is
 *      flipped together, and the flip is accepted *only if it makes the cell
 *      reconcile exactly* (ADR: "sign-flips accepted only when they make the
 *      cell reconcile exactly"). This captures pre-2022 refunds keyed in as
 *      positive amounts without hand-writing an override for each. Added lines
 *      are never auto-flipped — their sign is curated.
 *   4. Otherwise the cell is `"unreconciled"`, with the raw delta reported.
 *
 * `line` numbers in overrides are 1-based positions within the cell (the
 * `#line` of the line's importRef). An `add-line`'s declared `line` becomes
 * the synthetic line's index — and thus its importRef — so it is deterministic
 * and stable across re-extracts (pinned in the curated config, not derived
 * from the parsed count). It must not collide with a parsed line's index;
 * a collision throws rather than silently mis-keying the cell.
 */
export function reconcileCell(input: {
  cellValueCents: number;
  lines: ParsedTransactionLine[];
  overrides?: LineOverride[];
  refundKeywords?: string[];
  /** The cell's own column month (1–12) — dates an `add-line` that omits `month`. */
  budgetMonth?: number;
}): ReconcileResult {
  const { cellValueCents, lines, overrides = [], refundKeywords = [], budgetMonth } = input;

  const overrideByLine = new Map<number, LineOverride>();
  for (const o of overrides) overrideByLine.set(o.line, o);

  // Apply explicit overrides, dropping skipped lines but remembering each
  // survivor's original 1-based index for keyword-flip reporting.
  const working: { index: number; line: ParsedTransactionLine; added?: boolean }[] = [];
  lines.forEach((line, i) => {
    const override = overrideByLine.get(i + 1);
    if (override?.action === "skip") return;

    let amountCents = line.amountCents;
    if (override?.action === "sign-flip") amountCents = -amountCents;
    else if (override?.action === "set-amount") amountCents = override.amountCents;

    working.push({ index: i + 1, line: { ...line, amountCents } });
  });

  // Append synthetic add-line overrides (sorted by declared line for
  // deterministic ordering), collision-checked against the parsed indices.
  const additions = [...overrideByLine.values()]
    .filter((o): o is Extract<LineOverride, { action: "add-line" }> => o.action === "add-line")
    .sort((a, b) => a.line - b.line);
  for (const add of additions) {
    if (add.line <= lines.length) {
      throw new Error(
        `add-line override at line ${add.line} collides with a parsed line ` +
          `(cell has ${lines.length} parsed line(s)); use an index above the parsed count`,
      );
    }
    const month = add.month ?? budgetMonth;
    if (month === undefined) {
      throw new Error(
        `add-line override at line ${add.line} has no month and no budgetMonth was provided`,
      );
    }
    working.push({
      index: add.line,
      added: true,
      line: {
        kind: "transaction",
        month,
        day: add.day,
        amountCents: add.amountCents,
        vendor: add.vendor ?? null,
        note: add.note ?? null,
      },
    });
  }

  const sumOf = (rows: typeof working) =>
    rows.reduce((acc, r) => acc + r.line.amountCents, 0);

  const baseSum = sumOf(working);
  if (baseSum === cellValueCents) {
    return result("exact", working, [], cellValueCents, baseSum, 0);
  }

  // Conditional keyword sign-flip. Added lines are excluded: their sign is
  // curated in the override, so the heuristic must not second-guess it.
  const keywords = refundKeywords.map((k) => k.toLowerCase()).filter(Boolean);
  const flippable = working.filter(
    (r) => !r.added && r.line.amountCents > 0 && matchesKeyword(r.line, keywords),
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
