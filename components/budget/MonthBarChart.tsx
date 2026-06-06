import type { CategoryKind } from "@/types/budget";
import { monthLabelShort } from "@/lib/budget";

export function MonthBarChart({
  data,
  monthly,
  kind,
  highlightYm,
  width = 360,
  height = 130,
}: {
  data: { ym: string; total: number }[];
  /** Monthly cap (expense) or goal (savings). Drawn as a dashed target line. */
  monthly: number;
  kind: CategoryKind;
  /** Optional month key (YYYY-MM) to emphasize. */
  highlightYm?: string;
  width?: number;
  height?: number;
}) {
  const max = Math.max(monthly, ...data.map((d) => d.total), 1);
  const pad = { l: 32, r: 8, t: 12, b: 22 };
  const innerW = width - pad.l - pad.r;
  const innerH = height - pad.t - pad.b;
  const slot = innerW / data.length;
  const barW = Math.max(4, slot - 8);
  const targetY = pad.t + (1 - monthly / max) * innerH;

  return (
    <svg width="100%" viewBox={`0 0 ${width} ${height}`} className="text-muted-foreground">
      <line
        x1={pad.l}
        x2={pad.l + innerW}
        y1={targetY}
        y2={targetY}
        stroke="currentColor"
        strokeOpacity={0.4}
        strokeDasharray="3 3"
      />
      <text x={pad.l - 4} y={targetY + 3} textAnchor="end" className="fill-current text-[9px] opacity-60">
        {monthly.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })}
      </text>

      {data.map((d, i) => {
        const x = pad.l + i * slot + (slot - barW) / 2;
        const h = (d.total / max) * innerH;
        const y = pad.t + innerH - h;
        const isCurrent = d.ym === highlightYm;
        const meetsTarget =
          kind === "expense" ? d.total > monthly : d.total >= monthly;
        const color =
          kind === "expense"
            ? meetsTarget
              ? "fill-rose-500"
              : "fill-zinc-400 dark:fill-zinc-500"
            : meetsTarget
              ? "fill-emerald-500"
              : "fill-zinc-400 dark:fill-zinc-500";
        return (
          <g key={d.ym}>
            <rect
              x={x}
              y={y}
              width={barW}
              height={h}
              rx={3}
              className={`${color} ${isCurrent ? "opacity-100" : "opacity-70"}`}
            />
            <text
              x={x + barW / 2}
              y={height - 6}
              textAnchor="middle"
              className={`fill-current text-[9px] ${isCurrent ? "font-semibold opacity-100" : "opacity-60"}`}
            >
              {monthLabelShort(d.ym)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
