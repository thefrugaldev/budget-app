import type { Transaction } from "@/types/budget";

/**
 * Serializes Transactions to a CSV string for the Settings → Data export
 * (#81 story 5/6). Pure: no I/O, no DOM — the caller fetches the transactions
 * and category names and triggers the download. Column order matches the PRD:
 * Date, Category, Vendor, Amount, Note.
 *
 * The `amount` column carries the raw **signed** decimal (`-45.67` for a
 * refund/withdrawal, `1234.50` for a spend/contribution) — the CSV is a
 * faithful, machine-readable copy, not a formatted display, so it honors the
 * app's signed-amount convention without currency symbols or locale grouping.
 *
 * A category id with no matching name resolves to `"Unknown"` rather than being
 * dropped, so a transaction whose category was hard-deleted still exports.
 * An empty transaction list produces a header-only file (a valid CSV, and a
 * clear "nothing yet" rather than an error).
 *
 * The user-authored text columns (Category, Vendor, Note) are defused against
 * spreadsheet formula injection — see {@link defuseFormula}. Amount is left
 * alone (a leading `-` is a legitimate signed value) as is the format-fixed
 * Date.
 *
 * Rows are emitted in the order given — the caller decides the sort (the
 * repository already returns newest-first).
 */
const HEADER = ["Date", "Category", "Vendor", "Amount", "Note"] as const;

export function transactionsToCsv(
  transactions: Transaction[],
  categoryNameById: Map<string, string>,
): string {
  const lines = [HEADER.map(csvField).join(",")];

  for (const t of transactions) {
    lines.push(
      [
        t.date,
        defuseFormula(categoryNameById.get(t.categoryId) ?? "Unknown"),
        defuseFormula(t.vendor ?? ""),
        t.amount.toFixed(2),
        defuseFormula(t.note ?? ""),
      ]
        .map(csvField)
        .join(","),
    );
  }

  // CRLF line endings per RFC 4180 — the format Excel and Numbers expect.
  return lines.join("\r\n");
}

/**
 * RFC 4180 field escaping: a field is quoted only when it contains a comma,
 * double quote, or line break, and any embedded quote is doubled. Everything
 * else passes through untouched so a plain field like `2026-06-05` stays bare.
 */
function csvField(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Neutralizes CSV/formula injection: a spreadsheet (Excel, Sheets, Numbers)
 * evaluates any cell whose text starts with `=`, `+`, `-`, or `@` as a formula
 * on open. Prefixing a single quote forces the cell to be read as literal text.
 *
 * Applied only to the user-authored free-text columns (Category, Vendor, Note)
 * — never to Amount, whose leading `-` is a legitimate signed value, nor to the
 * format-fixed Date. Low risk for a single-user self-export, but the file is
 * portable and may be opened in a spreadsheet or shared. Runs before
 * {@link csvField} so the added quote is inside any RFC 4180 wrapping.
 */
function defuseFormula(value: string): string {
  return /^[=+\-@]/.test(value) ? `'${value}` : value;
}
