import Link from "next/link";

import { CategoryIcon } from "@/components/budget/category/CategoryIcon";
import { FulfillmentChip } from "@/components/budget/category/FulfillmentChip";
import { SignedAmount } from "@/components/budget/charts/SignedAmount";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { thresholdColor } from "@/lib/budget";
import { cn } from "@/lib/utils";
import type { AttentionResult } from "@/types/attention";

/**
 * Pulse's "Needs attention" module (issue #166 chunk 5, stories 17–20): the
 * exception rows only — expenses over cap, savings behind / not started /
 * withdrawn, and met goals — so Pulse answers "is anything wrong?" without
 * re-becoming the full category ledger. Fed by `selectAttention` (chunk 1), so
 * severity ordering and the display cap live in one tested place; this is
 * presentation only.
 *
 * Each row reuses the same signal vocabulary as the Categories ledger — the
 * text-bearing `FulfillmentChip` (never colour alone) and `thresholdColor` —
 * so meter, ledger, and Pulse never disagree (Harvest ADR 0002). Rows link to
 * the category detail page; an overflow count links to the full ledger rather
 * than silently hiding exceptions (story 19). When nothing needs attention the
 * module shows a positive state instead of dead space.
 */
export function NeedsAttention({ result }: { result: AttentionResult }) {
  const { rows, hiddenCount } = result;

  if (rows.length === 0) {
    return (
      <section>
        <SectionHeading>Needs attention</SectionHeading>
        <p className="rounded-xl bg-card px-4 py-6 text-center text-sm text-muted-foreground ring-1 ring-border">
          All categories on track.
        </p>
      </section>
    );
  }

  return (
    <section>
      <SectionHeading>Needs attention</SectionHeading>
      <ul className="overflow-hidden rounded-xl bg-card px-2 ring-1 ring-border">
        {rows.map(({ category, total, denominator }) => {
          const col = thresholdColor(category.kind, denominator, total);
          return (
            <li key={category.id} className="border-b border-border last:border-b-0">
              <Link
                href={`/categories/${category.id}`}
                className="flex items-center gap-3 rounded-lg px-1 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <CategoryIcon category={category} className="size-9" iconClassName="size-4" />
                <span className="min-w-0 flex-1 truncate font-medium leading-tight">
                  {category.name}
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
