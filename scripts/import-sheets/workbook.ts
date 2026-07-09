import { basename } from "node:path";

import ExcelJS from "exceljs";

/**
 * Workbook reading (chunk 2). Turns one `YYYY.xlsx` into a structured
 * {@link RawWorkbook} — the deterministic, cell-addressed shape the manifest
 * builder consumes. All ExcelJS contact is confined here; everything
 * downstream is pure and testable without a workbook.
 *
 * The three tabs (confirmed against 2020–2026):
 *   - **year grid** (sheet named by the 4-digit year): row 1 = month headers in
 *     columns B…M; each later row is `A` = category label, B…M = monthly totals
 *     whose **cell comments** itemize transactions. Columns are matched by
 *     header text (January…December), not fixed letters, so a shifted layout
 *     still reads correctly.
 *   - **Estimate**: `A` = category, `B` = monthly estimate. (Income rows here
 *     are ignored — ADR 0005 §6 sources income from W-2 config instead.)
 *   - **DebtsEquity** (transposed): row 1 columns B… = liability names up to a
 *     `Total Debts` column; `A2`…`A13` = month names; cells = balances.
 */

const MONTHS = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];

/** One month cell of a year-grid category row. */
export type RawGridCell = {
  /** 1–12. */
  month: number;
  /** A1 cell reference, e.g. `"D5"`. */
  cell: string;
  /** Numeric cell value in cents, or null when the cell is blank. */
  valueCents: number | null;
  /** Raw comment text (lines joined by `\n`), or null when there's no comment. */
  comment: string | null;
};

export type RawGridRow = {
  label: string;
  cells: RawGridCell[];
};

export type RawEstimateRow = {
  label: string;
  /** Cell reference of the estimate value, e.g. `"B2"`. */
  cell: string;
  monthlyCents: number;
};

export type RawLiabilityCell = {
  liability: string;
  /** 1–12. */
  month: number;
  cell: string;
  balanceCents: number;
};

export type RawWorkbook = {
  /** File basename, e.g. `"2023.xlsx"`. */
  file: string;
  /** The 4-digit year from the grid sheet name. */
  year: number;
  /** Grid sheet name (the year as a string). */
  gridSheet: string;
  gridRows: RawGridRow[];
  estimates: RawEstimateRow[];
  liabilities: RawLiabilityCell[];
};

/** Read a workbook file from disk into a {@link RawWorkbook}. */
export async function readWorkbook(filePath: string): Promise<RawWorkbook> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);
  const file = basename(filePath);
  return parseWorkbook(wb, file);
}

/** Read a workbook from an in-memory buffer (used by the fixture-based tests). */
export async function readWorkbookBuffer(
  buffer: ArrayBuffer | Buffer,
  file: string,
): Promise<RawWorkbook> {
  const wb = new ExcelJS.Workbook();
  // exceljs ships its own `Buffer` type, which drifts from newer @types/node's
  // generic `Buffer<ArrayBufferLike>`; bridge via the method's own param type.
  await wb.xlsx.load(buffer as unknown as Parameters<typeof wb.xlsx.load>[0]);
  return parseWorkbook(wb, file);
}

function parseWorkbook(wb: ExcelJS.Workbook, file: string): RawWorkbook {
  const gridSheet = wb.worksheets
    .map((ws) => ws.name)
    .find((name) => /^\d{4}$/.test(name));
  if (!gridSheet) {
    throw new Error(`${file}: no year-grid sheet (expected a 4-digit tab name)`);
  }
  const year = Number(gridSheet);

  return {
    file,
    year,
    gridSheet,
    gridRows: parseGrid(wb.getWorksheet(gridSheet)!),
    estimates: parseEstimates(wb.getWorksheet("Estimate")),
    liabilities: parseDebts(wb.getWorksheet("DebtsEquity")),
  };
}

function parseGrid(ws: ExcelJS.Worksheet): RawGridRow[] {
  const monthCols = monthColumns(ws.getRow(1));
  const rows: RawGridRow[] = [];

  ws.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const label = cellString(row.getCell(1));
    if (label === "") return;

    const cells: RawGridCell[] = [];
    for (const { month, col } of monthCols) {
      const cell = row.getCell(col);
      cells.push({
        month,
        cell: cell.address,
        valueCents: numberToCents(cell.value),
        comment: noteText(cell),
      });
    }
    rows.push({ label, cells });
  });

  return rows;
}

function parseEstimates(ws: ExcelJS.Worksheet | undefined): RawEstimateRow[] {
  if (!ws) return [];
  const rows: RawEstimateRow[] = [];
  ws.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const label = cellString(row.getCell(1));
    if (label === "") return;
    const valueCell = row.getCell(2);
    const cents = numberToCents(valueCell.value);
    if (cents === null) return;
    rows.push({ label, cell: valueCell.address, monthlyCents: cents });
  });
  return rows;
}

function parseDebts(ws: ExcelJS.Worksheet | undefined): RawLiabilityCell[] {
  if (!ws) return [];

  // Row 1: liability names across columns, stopping at the first "Total …"
  // column — everything to its right (totals, equity, notes) is not a liability.
  const header = ws.getRow(1);
  const liabilityCols: { liability: string; col: number }[] = [];
  let reachedTotal = false;
  header.eachCell((cell, col) => {
    if (reachedTotal || col === 1) return;
    const name = cellString(cell);
    if (name === "") return;
    if (/^total/i.test(name)) {
      reachedTotal = true;
      return;
    }
    liabilityCols.push({ liability: name, col });
  });

  const out: RawLiabilityCell[] = [];
  ws.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const month = MONTHS.indexOf(cellString(row.getCell(1)).toLowerCase()) + 1;
    if (month === 0) return;
    for (const { liability, col } of liabilityCols) {
      const cell = row.getCell(col);
      const cents = numberToCents(cell.value);
      if (cents === null) continue;
      out.push({ liability, month, cell: cell.address, balanceCents: cents });
    }
  });
  return out;
}

/** Map the grid header row's month-named cells to `{ month, col }`. */
function monthColumns(header: ExcelJS.Row): { month: number; col: number }[] {
  const cols: { month: number; col: number }[] = [];
  header.eachCell((cell, col) => {
    const idx = MONTHS.indexOf(cellString(cell).toLowerCase());
    if (idx !== -1) cols.push({ month: idx + 1, col });
  });
  return cols;
}

function cellString(cell: ExcelJS.Cell): string {
  const v = cell.value;
  if (v === null || v === undefined) return "";
  if (typeof v === "object" && "result" in v) return String(v.result ?? "");
  return String(v).trim();
}

/**
 * A numeric cell → integer cents, or null when blank/non-numeric. Rounds to
 * the nearest cent to absorb spreadsheet float noise (e.g. `152.10000000001`).
 */
function numberToCents(value: ExcelJS.CellValue): number | null {
  const n =
    typeof value === "number"
      ? value
      : value && typeof value === "object" && "result" in value
        ? Number(value.result)
        : NaN;
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

/** ExcelJS notes read back either as a string or a rich-text `{ texts }` object. */
function noteText(cell: ExcelJS.Cell): string | null {
  const note = cell.note as unknown;
  if (note === null || note === undefined) return null;
  if (typeof note === "string") return note.trim() || null;
  const texts = (note as { texts?: { text: string }[] }).texts;
  if (!texts) return null;
  const joined = texts.map((t) => t.text).join("").trim();
  return joined || null;
}
