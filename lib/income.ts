import type {
  Category,
  CategoryTarget,
  IncomeSourceStatus,
  PayCadence,
  Transaction,
} from "@/types/budget";
import { monthLabel } from "./budget";

/**
 * Average monthly amount for a recurring source paid `amountPerPaycheck` on the
 * given `cadence`. This is the figure stored as `CategoryTarget.monthly` so the
 * storage shape stays uniform across kinds (ADR 0001) — the cadence + per-paycheck
 * amount are a display/entry convenience layered on top, not a second source of
 * truth. Annual paycheck counts: weekly 52, bi-weekly 26, semi-monthly 24,
 * monthly 12 (so `monthly` cadence is a straight pass-through).
 */
export function monthlyFromCadence(
  amountPerPaycheck: number,
  cadence: PayCadence,
): number {
  switch (cadence) {
    case "weekly":
      return (amountPerPaycheck * 52) / 12;
    case "bi-weekly":
      return (amountPerPaycheck * 26) / 12;
    case "semi-monthly":
      return (amountPerPaycheck * 24) / 12;
    case "monthly":
      return amountPerPaycheck;
  }
}

/**
 * Inverse of {@link monthlyFromCadence}: recovers the per-paycheck amount from a
 * stored monthly baseline. Used by the `/income` card to show the lived
 * denomination (`$3,461.54 bi-weekly`) from the monthly figure that's actually
 * persisted (story 4). `monthly` cadence is a pass-through, mirroring the
 * forward helper.
 */
export function perPaycheckFromMonthly(
  monthly: number,
  cadence: PayCadence,
): number {
  switch (cadence) {
    case "weekly":
      return (monthly * 12) / 52;
    case "bi-weekly":
      return (monthly * 12) / 26;
    case "semi-monthly":
      return (monthly * 12) / 24;
    case "monthly":
      return monthly;
  }
}

const CADENCE_LABELS: Record<PayCadence, string> = {
  weekly: "weekly",
  "bi-weekly": "bi-weekly",
  "semi-monthly": "semi-monthly",
  monthly: "monthly",
};

/**
 * Human display name for a cadence (e.g. `$3,461.54 bi-weekly`). Decoupled from
 * the stored enum token so display copy can diverge from persistence later
 * without a data migration.
 */
export function cadenceLabel(cadence: PayCadence): string {
  return CADENCE_LABELS[cadence];
}

/**
 * What a one-time income source's `/income` card needs to tell its story (#46
 * stories 6/7): the signed sum received in `year` and the most recent receipt
 * that year. A one-time source has no baseline — it's measured against its own
 * transactions — so this is derived purely from the transaction log.
 *
 * `last` is null when the source has no receipts in `year`, which the card
 * renders as the "Awaiting first receipt" empty state. Basing the empty check
 * on receipt *presence* (not a zero sum) keeps a vest-then-reversed source that
 * nets to $0 out of the empty state — it did receive something.
 */
export type OneTimeReceiptSummary = {
  received: number;
  last: { date: string; noun: string } | null;
};

export function oneTimeReceiptSummary(
  transactions: Transaction[],
  categoryId: string,
  year: string,
): OneTimeReceiptSummary {
  let received = 0;
  let last: Transaction | undefined;
  for (const t of transactions) {
    if (t.categoryId !== categoryId) continue;
    if (t.date.slice(0, 4) !== year) continue;
    received += t.amount;
    // `>=` so that on a same-date tie the later array entry wins; transaction
    // order is otherwise unspecified and the rendered date is identical anyway.
    if (!last || t.date >= last.date) last = t;
  }
  return {
    received,
    last: last ? { date: last.date, noun: receiptNoun(last) } : null,
  };
}

/**
 * Picks the noun for the last-receipt line from the transaction's vendor/note
 * (`last vest …` / `last bonus …`), falling back to the neutral `receipt` when
 * neither keyword is present.
 */
function receiptNoun(t: Transaction): string {
  const haystack = `${t.vendor ?? ""} ${t.note ?? ""}`.toLowerCase();
  if (haystack.includes("vest")) return "vest";
  if (haystack.includes("bonus")) return "bonus";
  return "receipt";
}

/** UTC day number (integer days since the epoch) for a "YYYY-MM-DD" date. */
function toDayNumber(isoDate: string): number {
  const [y, m, d] = isoDate.split("-").map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 86_400_000);
}

/** Number of days in the calendar month "YYYY-MM". */
function daysInMonth(ym: string): number {
  const [y, m] = ym.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** "YYYY-MM-DD" for day-of-month `dom` within month "YYYY-MM". */
function dateInMonth(ym: string, dom: number): string {
  return `${ym}-${String(dom).padStart(2, "0")}`;
}

/**
 * Count of integers in `[fromDay, toDay]` (inclusive, day numbers) congruent to
 * `anchorDay` modulo `period`. The schedule is periodic in both directions from
 * the anchor, so a month later than the anchor still lands on the right phase.
 */
function countOnCadence(
  period: number,
  anchorDay: number,
  fromDay: number,
  toDay: number,
): number {
  if (toDay < fromDay) return 0;
  const rem = (((fromDay - anchorDay) % period) + period) % period;
  const firstPayday = rem === 0 ? fromDay : fromDay + (period - rem);
  if (firstPayday > toDay) return 0;
  return Math.floor((toDay - firstPayday) / period) + 1;
}

/**
 * Count of paychecks expected in month `ym` that fall on or before
 * `throughDate` ("YYYY-MM-DD"). `throughDate` is clamped to the month, so a
 * date past month-end counts the whole month and a date before month-start
 * counts zero — this is exactly the "paychecks received so far this month"
 * primitive Pulse needs to pro-rate YTD income by paychecks instead of calendar
 * days (story 9).
 *
 * Cadence semantics:
 *  - `weekly` / `bi-weekly` — periodic from `anchorDate` (the source's first
 *    known paycheck); 7- and 14-day strides. The anchor's *phase* is what
 *    matters, so bi-weekly naturally yields 3 paychecks in the ~2 months/year
 *    where a third stride lands inside the month, and 2 otherwise.
 *  - `semi-monthly` — the 1st and 15th, always 2 in a full month
 *    (anchor-independent).
 *  - `monthly` — one paycheck on the anchor's day-of-month, clamped to the
 *    month length (e.g. a 31st anchor pays on Feb 28).
 */
export function paychecksThroughDate(
  cadence: PayCadence,
  ym: string,
  throughDate: string,
  anchorDate: string,
): number {
  const monthFirst = toDayNumber(dateInMonth(ym, 1));
  const monthLast = toDayNumber(dateInMonth(ym, daysInMonth(ym)));
  const to = Math.min(monthLast, toDayNumber(throughDate));
  if (to < monthFirst) return 0;

  switch (cadence) {
    case "weekly":
      return countOnCadence(7, toDayNumber(anchorDate), monthFirst, to);
    case "bi-weekly":
      return countOnCadence(14, toDayNumber(anchorDate), monthFirst, to);
    case "semi-monthly": {
      let n = 0;
      for (const dom of [1, 15]) {
        if (toDayNumber(dateInMonth(ym, dom)) <= to) n++;
      }
      return n;
    }
    case "monthly": {
      const anchorDom = Number(anchorDate.split("-")[2]);
      const dom = Math.min(anchorDom, daysInMonth(ym));
      return toDayNumber(dateInMonth(ym, dom)) <= to ? 1 : 0;
    }
  }
}

/**
 * Count of paychecks expected across the whole calendar month `ym`. Thin
 * wrapper over {@link paychecksThroughDate} through month-end. `anchorDate`
 * (the source's first known paycheck) defaults to the first of the month for
 * cadences that need a phase (weekly/bi-weekly); pass an explicit anchor when
 * counting across multiple months so the phase stays consistent — e.g. summing
 * a bi-weekly source over a year yields 27 in the year a third stride lands.
 */
export function paychecksInMonth(
  cadence: PayCadence,
  ym: string,
  anchorDate: string = dateInMonth(ym, 1),
): number {
  return paychecksThroughDate(
    cadence,
    ym,
    dateInMonth(ym, daysInMonth(ym)),
    anchorDate,
  );
}

/**
 * Yearly⇄monthly conversion at the income UI boundary. Income targets are
 * stored monthly so the storage shape stays uniform across kinds (ADR 0001),
 * but they're entered and displayed as gross yearly (see CONTEXT.md and memory
 * `income_model`). Keep both conversions here so every income surface — the
 * `/income` card, its inline editor, and the category-detail Edit sheet —
 * shares one definition rather than re-deriving `× 12` / `÷ 12` inline.
 *
 * `monthlyToYearly` rounds to cents so a value stored as 8333.333…/mo reads
 * back as $100,000.00/yr in an editable field rather than float-drift like
 * 99999.99999999999.
 */
export function monthlyToYearly(monthly: number): number {
  return Math.round(monthly * 12 * 100) / 100;
}

export function yearlyToMonthly(yearly: number): number {
  return yearly / 12;
}

/**
 * Soonest `CategoryTarget` row for `categoryId` with
 * `effectiveFrom > currentMonth`. Returns `undefined` when no
 * future-effective row exists.
 *
 * Used by the `/income` card display (to surface the queued change in the
 * summary line) and by the per-row actions menu (to populate the
 * `cancelScheduledBaselineAction` form with the right `effectiveFrom`).
 */
export function nextScheduledTarget(
  categoryId: string,
  currentMonth: string,
  targets: CategoryTarget[],
): CategoryTarget | undefined {
  let best: CategoryTarget | undefined;
  for (const t of targets) {
    if (t.categoryId !== categoryId) continue;
    if (t.effectiveFrom <= currentMonth) continue;
    if (!best || t.effectiveFrom < best.effectiveFrom) best = t;
  }
  return best;
}

/**
 * Classifies an income source's row status for the `/income` page status pill.
 *
 * - "ended" wins when `activeUntil <= currentMonth` — the source has been
 *   marked as ending no later than the current month. (Per PRD: a source
 *   ending this month already reads as "ended" in the editor even though
 *   `isCategoryActiveForMonth` still treats the bound as inclusive.)
 * - "scheduled-change" applies to non-ended sources that have a
 *   `CategoryTarget` row with `effectiveFrom > currentMonth`. A past- or
 *   current-effective target is just the current baseline, not a queued change.
 * - "active" is the default.
 */
export function classifyIncomeSourceStatus(
  source: Category,
  currentMonth: string,
  targets: CategoryTarget[],
): IncomeSourceStatus {
  if (source.activeUntil && source.activeUntil <= currentMonth) return "ended";
  for (const t of targets) {
    if (t.categoryId !== source.id) continue;
    if (t.effectiveFrom > currentMonth) return "scheduled-change";
  }
  return "active";
}

/**
 * Display label for an income source row. Returns the bare name when no other
 * source shares the same normalized name; otherwise appends a status-aware
 * suffix so colliding rows are tellable apart at a glance
 * (e.g. `Bonus · scheduled change`, `Bonus · ended June 2026`).
 *
 * Collisions are case-insensitive and whitespace-trimmed.
 */
export function buildIncomeSourceDisplayLabel(
  source: Category,
  allSources: Category[],
  status: IncomeSourceStatus,
): string {
  const trimmedName = source.name.trim();
  const normalized = trimmedName.toLowerCase();
  const hasCollision = allSources.some(
    (other) =>
      other.id !== source.id && other.name.trim().toLowerCase() === normalized,
  );
  if (!hasCollision) return trimmedName;

  let suffix: string;
  switch (status) {
    case "ended":
      // `activeUntil` is guaranteed set when status === "ended" (see classifier).
      suffix = `ended ${monthLabel(source.activeUntil!)}`;
      break;
    case "scheduled-change":
      suffix = "scheduled change";
      break;
    case "active":
      suffix = `since ${monthLabel(source.activeFrom)}`;
      break;
  }
  return `${trimmedName} · ${suffix}`;
}
