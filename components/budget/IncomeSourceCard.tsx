import type { Category, CategoryTarget } from "@/types/budget";
import { fmt, monthLabel, resolveTargetForMonth } from "@/lib/budget";
import {
  buildIncomeSourceDisplayLabel,
  classifyIncomeSourceStatus,
  type IncomeSourceStatus,
} from "@/lib/income";
import { cn } from "@/lib/utils";

/**
 * Read-mode card for an income source on `/income` (chunk 4 of #39). Renders
 * emoji + display label + an exception-only status pill on a single row, with
 * a one-sentence baseline summary beneath. No edit chrome yet — the inline
 * editor lands in chunk 5 and the lifecycle ⋯ menu in chunk 6.
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
}: {
  source: Category;
  allSources: Category[];
  targets: CategoryTarget[];
  currentMonth: string;
}) {
  const status = classifyIncomeSourceStatus(source, currentMonth, targets);
  const label = buildIncomeSourceDisplayLabel(source, allSources, status);
  const summary = baselineSummary(source, targets, currentMonth, status);
  const pillCopy = statusPillCopy(source, status);

  return (
    <li
      aria-label={pillCopy ? `${label} · ${pillCopy}` : label}
      className={cn(
        "flex items-center gap-3 rounded-2xl bg-card p-4 ring-1 ring-border",
        status === "ended" && "opacity-75",
      )}
    >
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
            <StatusPill status={status} copy={pillCopy} />
          )}
        </div>
        <p className="mt-1 text-sm text-muted-foreground tabular-nums">
          {summary}
        </p>
      </div>
    </li>
  );
}

function StatusPill({
  status,
  copy,
}: {
  status: Exclude<IncomeSourceStatus, "active">;
  copy: string;
}) {
  const palette = {
    "scheduled-change":
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400",
    ended:
      "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-400",
  } satisfies Record<Exclude<IncomeSourceStatus, "active">, string>;
  return (
    <span
      className={cn(
        "inline-block rounded-full px-2 py-0.5 text-[11px] font-medium",
        palette[status],
      )}
    >
      {copy}
    </span>
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
    const lastBaseline =
      resolveTargetForMonth(source.id, source.activeUntil!, targets) * 12;
    return `Ended after ${monthLabel(source.activeUntil!)} · last baseline ${fmt(lastBaseline)}/yr`;
  }

  const currentMonthly = resolveTargetForMonth(source.id, currentMonth, targets);
  const currentYearly = currentMonthly * 12;
  const base = `${fmt(currentYearly)}/yr · ${fmt(currentMonthly)}/mo`;

  if (status === "scheduled-change") {
    const next = nextScheduledTarget(source.id, currentMonth, targets);
    if (next) {
      return `${base} → ${fmt(next.monthly * 12)}/yr starting ${monthLabel(next.effectiveFrom)}`;
    }
  }
  return base;
}

/**
 * Soonest target row for `categoryId` with `effectiveFrom > currentMonth`.
 * Returns `undefined` when no future-effective row exists.
 */
function nextScheduledTarget(
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
