import Link from "next/link";
import type { Category, Transaction } from "@/types/budget";
import { fmt, monthlyTotalsLastN, thresholdColor, thresholdFor } from "@/lib/budget";
import { cn } from "@/lib/utils";
import { SignedAmount } from "./SignedAmount";
import { ThresholdMeter } from "./ThresholdMeter";

export function CategoryCard({
  category,
  target,
  monthAmount,
  ytdAmount,
  transactions,
}: {
  category: Category;
  /** Resolved monthly target for the period being displayed. */
  target: number;
  monthAmount: number;
  ytdAmount: number;
  /** Used to draw the sparkline. */
  transactions: Transaction[];
}) {
  const state = thresholdFor(category.kind, target, monthAmount);
  const col = thresholdColor(category.kind, state);
  const pct = target === 0 ? 0 : monthAmount / target;
  const isSavings = category.kind === "savings";
  const isNegative = monthAmount < 0;

  return (
    <Link
      href={`/categories/${category.id}`}
      className={cn(
        "group relative flex flex-col gap-3 overflow-hidden rounded-2xl bg-card p-4 ring-1 transition-shadow hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring",
        isSavings ? "ring-emerald-200 dark:ring-emerald-900" : "ring-border",
      )}
    >
      {isNegative && (
        <span
          aria-hidden
          className="absolute inset-y-0 left-0 w-1 bg-rose-500"
        />
      )}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="grid size-11 place-items-center rounded-xl bg-muted text-2xl">
            {category.emoji}
          </div>
          <div>
            <p className="font-medium leading-tight">{category.name}</p>
            <p className="text-xs text-muted-foreground">
              {isSavings ? "Goal" : "Cap"} · {fmt(target)}/mo
            </p>
          </div>
        </div>
        <span
          className="text-xs text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
          aria-hidden
        >
          →
        </span>
      </div>

      <div>
        <div className="flex items-baseline justify-between">
          <span className={cn("font-heading text-xl font-semibold tabular-nums", col.text)}>
            <SignedAmount kind={category.kind} amount={monthAmount} />
          </span>
          <span className="text-xs text-muted-foreground tabular-nums">
            {Math.round(pct * 100)}% of {isSavings ? "goal" : "cap"}
          </span>
        </div>
        <ThresholdMeter kind={category.kind} target={target} amount={monthAmount} className="mt-2" />
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>YTD {fmt(ytdAmount)}</span>
        <Sparkline categoryId={category.id} transactions={transactions} />
      </div>
    </Link>
  );
}

function Sparkline({
  categoryId,
  transactions,
}: {
  categoryId: string;
  transactions: Transaction[];
}) {
  const data = monthlyTotalsLastN(transactions, categoryId, 6);
  const max = Math.max(...data.map((d) => d.total), 1);
  const W = 70;
  const H = 22;
  const step = W / (data.length - 1);
  const points = data.map((d, i) => `${i * step},${H - (d.total / max) * H}`).join(" ");
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden>
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        className="text-muted-foreground/60"
      />
    </svg>
  );
}
