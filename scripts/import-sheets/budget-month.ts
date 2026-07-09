/**
 * Budget-month dating (ADR 0005 decision 2). The spreadsheet files a payment
 * under the month it is *for*, which is the grid column — a mortgage paid 1/27
 * sits in the February column. So an imported transaction's date takes the
 * **column's** year and month with the line's **own** day-of-month, clamped to
 * a valid date. When the resulting date differs from the line's written date
 * (a different month, or a day clamped down), the true payment date is
 * preserved as a `(paid M/D)` note suffix — keeping monthly totals meaningful
 * while not losing the real date a future "already paid this month" feature
 * would want.
 */

/** Days in a given 1–12 month of a given year (handles leap Februaries). */
export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/**
 * Guard a 1–12 month. `parseCommentLine` already gates its own output, but this
 * module's functions are exported and called directly (chunk 2's extract, test
 * harnesses); an out-of-range month would otherwise be silently normalized by
 * `Date.UTC` (month 13 → January of the next year), so we fail loudly instead —
 * matching the posture in `money.ts`.
 */
function assertMonth(month: number, label: string): void {
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error(`${label} must be an integer 1–12, got ${month}`);
  }
}

export type BudgetMonthDate = {
  /** ISO date, "YYYY-MM-DD", in the budget month. */
  date: string;
  /** True when the written date was moved (different month, or day clamped). */
  coerced: boolean;
  /** `"(paid M/D)"` when coerced, else null — append to the note. */
  paidNote: string | null;
};

/**
 * Resolve a line's budget-month date. `commentMonth`/`commentDay` are the
 * line's written `M/D`; `budgetYear`/`budgetMonth` are the grid column. The day
 * is clamped into the budget month (e.g. a `1/31` line in a February column
 * lands on the 28th/29th). Coercion — and thus the `(paid M/D)` suffix, which
 * always shows the *written* date — triggers whenever the written month isn't
 * the budget month or the day had to be clamped.
 */
export function toBudgetMonthDate(input: {
  budgetYear: number;
  budgetMonth: number;
  commentMonth: number;
  commentDay: number;
}): BudgetMonthDate {
  const { budgetYear, budgetMonth, commentMonth, commentDay } = input;
  assertMonth(budgetMonth, "budgetMonth");
  assertMonth(commentMonth, "commentMonth");

  const maxDay = daysInMonth(budgetYear, budgetMonth);
  const clampedDay = Math.min(Math.max(commentDay, 1), maxDay);

  const date = `${budgetYear}-${pad2(budgetMonth)}-${pad2(clampedDay)}`;
  const coerced = commentMonth !== budgetMonth || clampedDay !== commentDay;
  const paidNote = coerced ? `(paid ${commentMonth}/${commentDay})` : null;

  return { date, coerced, paidNote };
}

/**
 * Fold a `(paid M/D)` suffix into a line's note. Returns the suffix alone when
 * there is no note, the note alone when there is no suffix, and `null` when
 * both are absent, so the caller can assign the result straight to an optional
 * `note` field.
 */
export function appendPaidNote(
  note: string | null,
  paidNote: string | null,
): string | null {
  if (!paidNote) return note;
  if (!note) return paidNote;
  return `${note} ${paidNote}`;
}
