"use client";

import { Pencil } from "lucide-react";
import { useRef, useState } from "react";

import { CategoryIcon } from "@/components/budget/category/CategoryIcon";
import { IncomeSourceCardActions } from "@/components/budget/income/IncomeSourceCardActions";
import { IncomeSourceEditor } from "@/components/budget/income/IncomeSourceEditor";
import { IncomeSourceStatusPill } from "@/components/budget/income/IncomeSourceStatusPill";
import { useCanEdit } from "@/hooks/useCanEdit";
import {
  fmt,
  fmtExact,
  longDateLabel,
  monthLabel,
  resolveTargetForMonth,
} from "@/lib/budget";
import {
  buildIncomeSourceDisplayLabel,
  cadenceLabel,
  classifyIncomeSourceStatus,
  monthlyToYearly,
  nextScheduledTarget,
  perPaycheckFromMonthly,
} from "@/lib/income";
import { cn } from "@/lib/utils";
import type {
  Category,
  CategoryTarget,
  IncomeSourceStatus,
  OneTimeReceiptSummary,
} from "@/types/budget";

/**
 * Read-mode + inline editor card for an income source on `/income`
 * (chunks 4–6 of #39). Renders emoji + display label + an exception-only
 * status pill on a single row, with a one-sentence baseline summary
 * beneath. The Edit pencil expands `IncomeSourceEditor` beneath the row;
 * `IncomeSourceCardActions` adds the per-row ⋯ menu (End / Cancel
 * scheduled change / Reopen / Delete) and the leading `Reopen` button on
 * ended rows.
 *
 * Status pill is rendered only for exceptions — "Scheduled change" and
 * "Ended" — so a card with no pill reads as the default "ongoing" state.
 * Active was originally specced as its own pill but proved to be visual tax
 * on the common case (the default state doesn't earn screen space).
 *
 * Display rules per PRD:
 *  - "active": `$X/yr · $Y/mo`
 *  - "scheduled-change": `$X/yr · $Y/mo → $Z/yr starting <month>`
 *  - "ended": `Ended after <month> · last baseline $X/yr`
 *
 * Accessibility: each card is a labelled `<li>` whose `aria-label` is the
 * display label, plus the pill copy when one is shown — so screen readers
 * announce the exception status rather than depending on colour (story 18).
 */
export function IncomeSourceCard({
  source,
  allSources,
  targets,
  currentMonth,
  txCount,
  oneTimeSummary,
}: {
  source: Category;
  allSources: Category[];
  targets: CategoryTarget[];
  currentMonth: string;
  /** Transaction count on this source — gates hard-delete in the ⋯ menu. */
  txCount: number;
  /** Receipt summary for one-time sources (computed server-side); undefined
   * for recurring sources, which read their summary from `targets`. */
  oneTimeSummary?: OneTimeReceiptSummary;
}) {
  const status = classifyIncomeSourceStatus(source, currentMonth, targets);
  const label = buildIncomeSourceDisplayLabel(source, allSources, status);
  // One-time sources tell a receipts story (chunk 5); recurring/legacy sources
  // tell a baseline story. The status pill logic is shared either way.
  const summary =
    source.incomeFrequency === "one-time"
      ? oneTimeSummaryText(oneTimeSummary, currentMonth.slice(0, 4))
      : baselineSummary(source, targets, currentMonth, status);
  const pillCopy = statusPillCopy(source, status);
  const currentMonthly = resolveTargetForMonth(
    source.id,
    currentMonth,
    targets,
  );
  const scheduledTarget = nextScheduledTarget(source.id, currentMonth, targets);
  const targetRowCount = targets.reduce(
    (n, t) => (t.categoryId === source.id ? n + 1 : n),
    0,
  );
  const isEnded = status === "ended";

  const [editing, setEditing] = useState(false);
  const editTriggerRef = useRef<HTMLButtonElement>(null);
  const canEdit = useCanEdit();
  // `isActive` gates on the source's lifecycle (not ended); `canEdit` is the
  // role gate (consistent with every other surface). Both must hold to show the
  // inline editor (#111 story 9).
  const isActive = !isEnded;

  const closeEditor = () => {
    setEditing(false);
    // Restore focus to the pencil so keyboard users land back where they
    // left off (story 17).
    requestAnimationFrame(() => editTriggerRef.current?.focus());
  };

  return (
    <li
      aria-label={pillCopy ? `${label} · ${pillCopy}` : label}
      className={cn(
        "rounded-2xl bg-card p-4 ring-1 ring-border",
        status === "ended" && "opacity-75",
      )}
    >
      <div className="flex items-center gap-3">
        <CategoryIcon category={source} />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-medium leading-tight">{label}</span>
            {status !== "active" && pillCopy && (
              <IncomeSourceStatusPill status={status} copy={pillCopy} />
            )}
          </div>
          <p className="mt-1 text-sm text-muted-foreground tabular-nums">
            {summary}
          </p>
        </div>
        {canEdit && isActive && !editing && (
          <button
            ref={editTriggerRef}
            type="button"
            onClick={() => setEditing(true)}
            aria-label={`Edit ${label}`}
            className="inline-flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground ring-1 ring-border transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Pencil className="size-3.5" aria-hidden />
          </button>
        )}
        <IncomeSourceCardActions
          source={source}
          isEnded={isEnded}
          txCount={txCount}
          targetRowCount={targetRowCount}
          scheduledTarget={scheduledTarget}
        />
      </div>
      {editing && isActive && (
        <IncomeSourceEditor
          source={source}
          currentMonthly={currentMonthly}
          currentMonth={currentMonth}
          onClose={closeEditor}
        />
      )}
    </li>
  );
}

function statusPillCopy(
  source: Category,
  status: IncomeSourceStatus,
): string | null {
  switch (status) {
    case "active":
      return null;
    case "scheduled-change":
      return "Scheduled change";
    case "ended":
      // `activeUntil` is guaranteed set when status === "ended".
      return `Ended ${monthLabel(source.activeUntil!)}`;
  }
}

/**
 * Summary line for a one-time source (chunk 5): YTD received + last-receipt
 * date, or the honest empty-state copy when nothing has landed this year. The
 * structured figures come from the server-side `oneTimeReceiptSummary`; this
 * just formats them.
 */
function oneTimeSummaryText(
  summary: OneTimeReceiptSummary | undefined,
  year: string,
): string {
  if (!summary || !summary.last) return `Awaiting first receipt of ${year}`;
  return `${fmt(summary.received)} received YTD · last ${summary.last.noun} ${longDateLabel(summary.last.date)}`;
}

function baselineSummary(
  source: Category,
  targets: CategoryTarget[],
  currentMonth: string,
  status: IncomeSourceStatus,
): string {
  if (status === "ended") {
    const lastBaseline = monthlyToYearly(
      resolveTargetForMonth(source.id, source.activeUntil!, targets),
    );
    return `Ended after ${monthLabel(source.activeUntil!)} · last baseline ${fmt(lastBaseline)}/yr`;
  }

  const currentMonthly = resolveTargetForMonth(source.id, currentMonth, targets);
  const currentYearly = monthlyToYearly(currentMonthly);

  // Recurring sources with a cadence lead with the lived per-paycheck figure
  // (story 4) — `$3,461.54 bi-weekly · $90,000/yr`. fmtExact keeps the cents
  // that make the amount match a bank statement (fmt would drop them above
  // $100). Cadence-unset recurring (migrated legacy) and one-time sources
  // (chunk 5 reshapes those) keep today's `$X/yr · $Y/mo` summary.
  const base =
    source.incomeFrequency === "recurring" && source.payCadence
      ? `${fmtExact(perPaycheckFromMonthly(currentMonthly, source.payCadence))} ${cadenceLabel(source.payCadence)} · ${fmt(currentYearly)}/yr`
      : `${fmt(currentYearly)}/yr · ${fmt(currentMonthly)}/mo`;

  if (status === "scheduled-change") {
    const next = nextScheduledTarget(source.id, currentMonth, targets);
    if (next) {
      return `${base} → ${fmt(monthlyToYearly(next.monthly))}/yr starting ${monthLabel(next.effectiveFrom)}`;
    }
  }
  return base;
}
