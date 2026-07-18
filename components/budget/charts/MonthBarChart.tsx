"use client";

import { useState } from "react";

import type { CategoryKind, MonthBarDatum } from "@/types/budget";
import { barTone, monthLabel, monthLabelShort } from "@/lib/budget";
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

const usd = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

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

  // Hovered month index → cursor-following tooltip. Positioned in viewBox-%
  // (not px) so it tracks the bar regardless of the SVG's rendered size.
  const [hovered, setHovered] = useState<number | null>(null);
  const active = hovered !== null ? data[hovered] : null;

  return (
    <div className="relative">
      <svg
        width="100%"
        viewBox={`0 0 ${width} ${height}`}
        className="text-muted-foreground"
        onPointerLeave={() => setHovered(null)}
      >
        <text
          x={pad.l - 4}
          y={labelY + 3}
          textAnchor="end"
          className="fill-current text-[9px]"
        >
          {usd(labelTarget)}
        </text>

        {data.map((d, i) => {
          const x = xBand.center(i) - barW / 2;
          const h = yScale.length(d.total);
          const y = baseline - h;
          const isCurrent = d.ym === highlightYm;
          const tone = barTone(kind, d.target, d.total);
          const color = tone ? TONE_FILL[tone] : "fill-muted-foreground";
          // Every month renders at full strength: a trend reads by its shape
          // across equally-weighted bars, and signal fills (over cap / net-
          // negative) must not be dimmed. The current month is called out by its
          // bold label, not by fading the rest — dimming would spotlight the one
          // in-progress (partial, often-empty) bar over the complete history.
          const targetY = baseline - yScale.length(d.target);
          // Value only — the dashed cap line already shows the target, so
          // repeating it here just bloats the tooltip.
          const label = `${monthLabel(d.ym)} · ${usd(d.total)}`;
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
              {/* Full-column hit target: hovering (or focusing) anywhere in the
                  month's slot surfaces the tooltip; the native <title> carries
                  the same text to keyboard/screen-reader users. */}
              <rect
                x={xBand.center(i) - xBand.slot / 2}
                y={pad.t}
                width={xBand.slot}
                height={innerH}
                fill="transparent"
                tabIndex={0}
                className="cursor-default outline-none focus-visible:fill-muted-foreground/10"
                onPointerEnter={() => setHovered(i)}
                onFocus={() => setHovered(i)}
                onBlur={() => setHovered(null)}
              >
                <title>{label}</title>
              </rect>
            </g>
          );
        })}
      </svg>

      {active && (
        <div
          aria-hidden
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-md bg-popover px-2 py-1 text-xs whitespace-nowrap text-popover-foreground shadow-md ring-1 ring-border"
          style={{
            left: `${(xBand.center(hovered!) / width) * 100}%`,
            top: `${((baseline - yScale.length(active.total)) / height) * 100}%`,
          }}
        >
          <span className="font-medium">{monthLabel(active.ym)}</span>
          <span className="tabular-nums">
            {" · "}
            {usd(active.total)}
          </span>
        </div>
      )}
    </div>
  );
}
