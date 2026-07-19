import Link from "next/link";

import { CategoryIcon } from "@/components/budget/category/CategoryIcon";
import { FulfillmentChip } from "@/components/budget/category/FulfillmentChip";
import { SignedAmount } from "@/components/budget/charts/SignedAmount";
import { PendingNote } from "@/components/budget/pulse/PendingNote";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { thresholdColor } from "@/lib/budget";
import { cn } from "@/lib/utils";
import type { AttentionResult } from "@/types/attention";

/**
 * Pulse's "Needs attention" module (issue #166 chunk 5; pace-aware in #178):
 * the exception rows only — expenses over cap, savings behind / withdrawn / (on
 * a closed window) not started, and met goals — plus a calm "pending" note for
 * goals not yet funded early in the month, so Pulse answers "is anything
 * wrong?" without flagging routine early-month state as a problem or
 * re-becoming the full category ledger. Fed by `selectAttention`, so severity
 * ordering, the pace model, and the display cap live in one tested place; this
 * is presentation only.
 *
 * Each row reuses the same signal vocabulary as the Categories ledger — the
 * text-bearing `FulfillmentChip` (never colour alone) and `thresholdColor` — so
 * meter, ledger, and Pulse never disagree (Harvest ADR 0002), and carries the
 * gap-action verb from the selector so a glance says what to do. Rows link to
 * the category detail page; an overflow count links to the full ledger rather
 * than silently hiding exceptions (story 19). When nothing needs attention the
 * module shows a confident "N of N on track" affirmation instead of dead space.
 */
export function NeedsAttention({ result }: { result: AttentionResult }) {
  const { rows, hiddenCount, pending, evaluatedCount, onTrackCount } = result;

  if (rows.length === 0) {
    return (
      <section>
        <SectionHeading>Needs attention</SectionHeading>
        {pending.length > 0 ? (
          <PendingNote pending={pending} />
        ) : (
          <p className="rounded-xl bg-card px-4 py-6 text-center text-sm text-muted-foreground ring-1 ring-border">
            {evaluatedCount > 0
              ? `Nothing needs attention — ${onTrackCount} of ${evaluatedCount} on track.`
              : "Nothing needs attention."}
          </p>
        )}
      </section>
    );
  }

  return (
    <section>
      <SectionHeading>Needs attention</SectionHeading>
      <ul className="overflow-hidden rounded-xl bg-card px-2 ring-1 ring-border">
        {rows.map(({ category, total, denominator, action }) => {
          const col = thresholdColor(category.kind, denominator, total);
          return (
            <li key={category.id} className="border-b border-border last:border-b-0">
              <Link
                href={`/categories/${category.id}`}
                className="flex items-center gap-3 rounded-lg px-1 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <CategoryIcon category={category} className="size-9" iconClassName="size-4" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium leading-tight">
                    {category.name}
                  </span>
                  {action && (
                    <span className="block truncate text-xs text-muted-foreground">
                      {action}
                    </span>
                  )}
                </span>
                <FulfillmentChip
                  kind={category.kind}
                  total={total}
                  denominator={denominator}
                />
                <span className={cn("shrink-0 font-medium tabular-nums", col.text)}>
                  <SignedAmount kind={category.kind} amount={total} />
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
      {pending.length > 0 && <PendingNote pending={pending} className="mt-3" />}
      {hiddenCount > 0 && (
        <Link
          href="/categories"
          className="mt-3 inline-flex text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          +{hiddenCount} more in Categories →
        </Link>
      )}
    </section>
  );
}
