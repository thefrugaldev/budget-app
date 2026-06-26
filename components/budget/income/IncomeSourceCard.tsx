"use client";

import { Pencil } from "lucide-react";
import { useRef, useState } from "react";

import { IncomeSourceCardActions } from "@/components/budget/income/IncomeSourceCardActions";
import { IncomeSourceEditor } from "@/components/budget/income/IncomeSourceEditor";
import { IncomeSourceStatusPill } from "@/components/budget/income/IncomeSourceStatusPill";
import { fmt, monthLabel, resolveTargetForMonth } from "@/lib/budget";
import {
  buildIncomeSourceDisplayLabel,
  classifyIncomeSourceStatus,
  monthlyToYearly,
  nextScheduledTarget,
} from "@/lib/income";
import { cn } from "@/lib/utils";
import type {
  Category,
  CategoryTarget,
  IncomeSourceStatus,
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
}: {
  source: Category;
  allSources: Category[];
  targets: CategoryTarget[];
  currentMonth: string;
  /** Transaction count on this source — gates hard-delete in the ⋯ menu. */
  txCount: number;
}) {
  const status = classifyIncomeSourceStatus(source, currentMonth, targets);
  const label = buildIncomeSourceDisplayLabel(source, allSources, status);
  const summary = baselineSummary(source, targets, currentMonth, status);
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
  const canEdit = !isEnded;

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
        <span
          aria-hidden
          className="grid size-11 shrink-0 place-items-center rounded-xl bg-muted text-2xl"
        >
          {source.emoji}
        </span>
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
        {canEdit && !editing && (
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
      {editing && canEdit && (
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
  const base = `${fmt(currentYearly)}/yr · ${fmt(currentMonthly)}/mo`;

  if (status === "scheduled-change") {
    const next = nextScheduledTarget(source.id, currentMonth, targets);
    if (next) {
      return `${base} → ${fmt(monthlyToYearly(next.monthly))}/yr starting ${monthLabel(next.effectiveFrom)}`;
    }
  }
  return base;
}
