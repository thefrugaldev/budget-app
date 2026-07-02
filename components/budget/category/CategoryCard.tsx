import Link from "next/link";
import type { Category, Transaction } from "@/types/budget";
import { fmt, targetLabel, thresholdColor, thresholdDescriptor } from "@/lib/budget";
import { cn } from "@/lib/utils";
import { SignedAmount } from "@/components/budget/charts/SignedAmount";
import { ThresholdMeter } from "@/components/budget/charts/ThresholdMeter";
import { CategoryIcon } from "@/components/budget/category/CategoryIcon";
import { EndedBadge } from "@/components/budget/category/EndedBadge";
import { Sparkline } from "@/components/budget/category/Sparkline";

export function CategoryCard({
  category,
  total,
  denominator,
  perMonthTarget,
  transactions,
}: {
  category: Category;
  /** Signed sum of in-range transaction amounts. May be negative. */
  total: number;
  /** Sum of historically-resolved targets across active months in range. */
  denominator: number;
  /**
   * Resolved monthly target for the latest month in range. Used for the
   * "Cap · $X/mo" sub-label so the card always advertises the user's
   * current cap, not a stale per-month value.
   */
  perMonthTarget: number;
  /** Used to draw the 6-month sparkline (independent of range). */
  transactions: Transaction[];
}) {
  const col = thresholdColor(category.kind, denominator, total);
  const descriptor = thresholdDescriptor(category.kind, denominator, total);
  const pct = denominator === 0 ? 0 : total / denominator;
  const isInflow = category.kind !== "expense";
  const label = targetLabel(category.kind);
  const isNegative = total < 0;

  return (
    <Link
      href={`/categories/${category.id}`}
      className={cn(
        "group relative flex flex-col gap-3 overflow-hidden rounded-2xl bg-card p-4 ring-1 transition-shadow hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring",
        isInflow ? "ring-emerald-200 dark:ring-emerald-900" : "ring-border",
      )}
    >
      {isNegative && (
        <span
          aria-hidden
          className="absolute inset-y-0 left-0 w-1 bg-rose-500"
        />
      )}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3">
          <CategoryIcon category={category} />
          <div className="min-w-0">
            <p className="font-medium leading-tight">{category.name}</p>
            <p className="text-xs text-muted-foreground">
              {label} · {fmt(perMonthTarget)}/mo
            </p>
            {category.activeUntil && (
              <EndedBadge ym={category.activeUntil} className="mt-1" />
            )}
          </div>
        </div>
        <span
          className="shrink-0 text-xs text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
          aria-hidden
        >
          →
        </span>
      </div>

      <div>
        <div className="flex items-baseline justify-between gap-2">
          <span className={cn("font-heading text-xl font-semibold tabular-nums", col.text)}>
            <SignedAmount kind={category.kind} amount={total} />
          </span>
          <span className="flex shrink-0 items-baseline gap-1.5">
            {/* Text-bearing threshold signal so the state is legible without
                relying on the meter color (#79 story 5). Color/icon styling of
                this chip is owned by the identity PRD (#80). */}
            <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium leading-none text-muted-foreground">
              {descriptor.label}
            </span>
            <span className="text-xs text-muted-foreground tabular-nums">
              {Math.round(pct * 100)}%
            </span>
          </span>
        </div>
        <ThresholdMeter kind={category.kind} target={denominator} amount={total} className="mt-2" />
      </div>

      <div className="flex items-center justify-end text-xs text-muted-foreground">
        <Sparkline categoryId={category.id} transactions={transactions} />
      </div>
    </Link>
  );
}
