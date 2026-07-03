import type { CategoryKind, MonthBarDatum } from "@/types/budget";
import { monthLabelShort, thresholdDescriptor } from "@/lib/budget";
import { bandScale, domainMax, linearScale } from "@/lib/charts/scale";
import type { ThresholdTone } from "@/types/threshold";

// The bar fill reuses the same threshold model as the card meter and Pulse so
// the trend can never disagree with them: green under/near cap, amber at cap
// (90–100%), red over. A month with no cap that period has nothing to signal
// against, so it stays neutral.
const TONE_FILL: Record<ThresholdTone, string> = {
  good: "fill-signal-good",
  warn: "fill-signal-warn",
  bad: "fill-signal-bad",
};

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
        className="fill-current text-[9px]"
      >
        {labelTarget.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })}
      </text>

      {data.map((d, i) => {
        const x = xBand.center(i) - barW / 2;
        const h = yScale.length(d.total);
        const y = baseline - h;
        const isCurrent = d.ym === highlightYm;
        const tone = d.target > 0 ? thresholdDescriptor(kind, d.target, d.total).tone : null;
        const color = tone ? TONE_FILL[tone] : "fill-muted-foreground";
        // Every month renders at full strength: a trend reads by its shape
        // across equally-weighted bars, and signal fills (over cap / net-
        // negative) must not be dimmed. The current month is called out by its
        // bold label, not by fading the rest — dimming would spotlight the one
        // in-progress (partial, often-empty) bar over the complete history.
        const targetY = baseline - yScale.length(d.target);
        return (
          <g key={d.ym}>
            <rect x={x} y={y} width={barW} height={h} rx={3} className={color} />
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
              className={`fill-current text-[9px] ${isCurrent ? "font-semibold" : ""}`}
            >
              {monthLabelShort(d.ym)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
