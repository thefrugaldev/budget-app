import type { Transaction } from "@/types/budget";
import { monthlyTotalsLastN } from "@/lib/budget";

/**
 * Tiny 6-month trend line drawn on each category card. Independent of the
 * selected range — always the trailing six months — so the card carries a
 * stable at-a-glance trajectory regardless of the page's time horizon.
 */
export function Sparkline({
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
