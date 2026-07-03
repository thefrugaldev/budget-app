import type { CategoryKind, MonthBarDatum } from "@/types/budget";
import { monthLabelShort } from "@/lib/budget";
import { bandScale, domainMax, linearScale } from "@/lib/charts/scale";

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
  const pad = { l: 32, r: 8, t: 12, b: 22 };
  const innerW = width - pad.l - pad.r;
  const innerH = height - pad.t - pad.b;
  const baseline = pad.t + innerH;
  const domain = domainMax([...data.map((d) => d.target), ...data.map((d) => d.total)]);
  const yScale = linearScale(domain, innerH);
  const xBand = bandScale(data.length, innerW, pad.l);
  const barW = Math.max(4, xBand.slot - 8);
  // Pick the latest non-zero target as the y-axis label so a quick visual scan
  // anchors against the current cap. Falls back to the domain max if every
  // target is 0.
  const labelTarget =
    [...data].reverse().find((d) => d.target > 0)?.target ?? domain;
  const labelY = baseline - yScale.length(labelTarget);

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
        const x = xBand.center(i) - barW / 2;
        const h = yScale.length(d.total);
        const y = baseline - h;
        const isCurrent = d.ym === highlightYm;
        const meetsTarget =
          d.target > 0 &&
          (kind === "expense" ? d.total > d.target : d.total >= d.target);
        // Palette signals: an expense over its cap reads bad, a savings month
        // meeting its goal reads good, everything else stays neutral. The
        // signal/muted tokens already flip for light vs dark.
        const color = !meetsTarget
          ? "fill-muted-foreground"
          : kind === "expense"
            ? "fill-signal-bad"
            : "fill-signal-good";
        const targetY = baseline - yScale.length(d.target);
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
