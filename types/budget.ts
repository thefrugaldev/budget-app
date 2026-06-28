export type CategoryKind = "expense" | "savings" | "income";

/**
 * Pay schedule for a recurring income source. Drives the lived-denomination
 * display on `/income` cards and paycheck-aware YTD pro-ration on Pulse (#46).
 * Only meaningful for `kind: "income"` sources; chunk 2 of #46 adds the
 * optional `payCadence` field to `Category`.
 */
export type PayCadence = "weekly" | "bi-weekly" | "semi-monthly" | "monthly";

/**
 * Whether an income source arrives on a schedule (`recurring` — salary, paid
 * gigs) or sporadically (`one-time` — annual bonus, RSU vests, side gig). Only
 * meaningful for `kind: "income"`. Drives the two-step Add form, card display,
 * and YTD pro-ration (#46). Existing income rows read back as `"recurring"`
 * (see `toCategory`).
 */
export type IncomeFrequency = "recurring" | "one-time";

/**
 * Row status for an income source on `/income`. Derived from the source's
 * lifecycle + target history by `classifyIncomeSourceStatus` (`lib/income.ts`)
 * and consumed by the card + status pill. "active" is the default (no pill);
 * "scheduled-change" and "ended" are the exception states.
 */
export type IncomeSourceStatus = "active" | "scheduled-change" | "ended";

export type Category = {
  id: string;
  name: string;
  emoji: string;
  kind: CategoryKind;
  /** Inclusive lower bound, "YYYY-MM". */
  activeFrom: string;
  /** Inclusive upper bound, "YYYY-MM". Undefined means "no end". */
  activeUntil?: string;
  /**
   * Only meaningful when `kind === "income"`. Existing income rows migrate to
   * `"recurring"` on read (story 8); non-income categories leave it undefined.
   */
  incomeFrequency?: IncomeFrequency;
  /**
   * Only set when `incomeFrequency === "recurring"`. Undefined for one-time
   * sources and for legacy recurring sources whose cadence is unset — the
   * latter falls back to calendar-day YTD pro-ration (story 10).
   */
  payCadence?: PayCadence;
  /**
   * A known real payday, "YYYY-MM-DD" — the phase anchor for paycheck-aware YTD
   * pro-ration. Lets weekly/bi-weekly paydays land on the right day-of-week and
   * a monthly cadence on the right day-of-month, instead of assuming the 1st of
   * `activeFrom`. Optional and only meaningful for cadence-set recurring
   * sources; when unset, pro-ration falls back to the first of `activeFrom`.
   * (Ignored for `semi-monthly`, which always pays the 1st and 15th.)
   */
  firstPaycheckDate?: string;
};

/**
 * Effective-dated monthly target for a category. The target in effect for
 * month M is the row with the greatest `effectiveFrom <= M`.
 */
export type CategoryTarget = {
  categoryId: string;
  monthly: number;
  effectiveFrom: string; // "YYYY-MM"
};

export type Transaction = {
  id: string;
  categoryId: string;
  /** Signed. Positive = spend / contribution / income received. Negative =
   * refund / withdrawal / income reversed. Monthly totals may be negative. */
  amount: number;
  date: string; // ISO date, e.g. "2026-06-05"
  vendor?: string;
  note?: string;
};

export type MonthlySpendByCategory = {
  categoryId: string;
  categoryName: string;
  total: number;
};

/** Per-month datum for the category trend bar chart. */
export type MonthBarDatum = {
  ym: string;
  total: number;
  /**
   * Historically-resolved target for this month — drawn as a per-bar dashed
   * segment. A target raised mid-range still shows each past bar against the
   * cap that was actually in effect that month.
   */
  target: number;
};

/** YTD summary for a one-time income source: total received + last receipt. */
export type OneTimeReceiptSummary = {
  received: number;
  last: { date: string; noun: string } | null;
};

/** Precision mode for the shared AmountInput (auto-decimal cents vs whole dollars). */
export type AmountPrecision = "cents" | "whole";
