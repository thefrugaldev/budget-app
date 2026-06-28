import type { CategoryKind, MonthBarDatum } from "@/types/budget";
import { monthLabelShort } from "@/lib/budget";

export function MonthBarChart({
  data,
  kind,
  highlightYm,
  width = 360,
  height = 130,
}: {
  data: MonthBarDatum[];
  kind: CategoryKind;
  /** Optional month key (YYYY-MM) to emphasize. */
  highlightYm?: string;
  width?: number;
  height?: number;
}) {
  const max = Math.max(
    ...data.map((d) => d.target),
    ...data.map((d) => d.total),
    1,
  );
  const pad = { l: 32, r: 8, t: 12, b: 22 };
  const innerW = width - pad.l - pad.r;
  const innerH = height - pad.t - pad.b;
  const slot = innerW / data.length;
  const barW = Math.max(4, slot - 8);
  // Pick the latest non-zero target as the y-axis label so a quick visual scan
  // anchors against the current cap. Falls back to max if every target is 0.
  const labelTarget =
    [...data].reverse().find((d) => d.target > 0)?.target ?? max;
  const labelY = pad.t + (1 - labelTarget / max) * innerH;

  return (
    <svg width="100%" viewBox={`0 0 ${width} ${height}`} className="text-muted-foreground">
      <text
        x={pad.l - 4}
        y={labelY + 3}
        textAnchor="end"
        className="fill-current text-[9px] opacity-60"
      >
        {labelTarget.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })}
      </text>

      {data.map((d, i) => {
        const x = pad.l + i * slot + (slot - barW) / 2;
        const h = (Math.max(0, d.total) / max) * innerH;
        const y = pad.t + innerH - h;
        const isCurrent = d.ym === highlightYm;
        const meetsTarget =
          d.target > 0 &&
          (kind === "expense" ? d.total > d.target : d.total >= d.target);
        const color =
          kind === "expense"
            ? meetsTarget
              ? "fill-rose-500"
              : "fill-zinc-400 dark:fill-zinc-500"
            : meetsTarget
              ? "fill-emerald-500"
              : "fill-zinc-400 dark:fill-zinc-500";
        const targetY = pad.t + (1 - d.target / max) * innerH;
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
            {d.target > 0 && (
              <line
                x1={x - 2}
                x2={x + barW + 2}
                y1={targetY}
                y2={targetY}
                stroke="currentColor"
                strokeOpacity={0.5}
                strokeDasharray="3 3"
              />
            )}
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
