"use client";

import { useRef, useState } from "react";

import { fmt, monthLabelShort } from "@/lib/budget";
import { bandScale, domainMax, linearScale } from "@/lib/charts/scale";
import type { MonthlyTrendPoint } from "@/types/budget";

/**
 * The Pulse signature (#80 — the chosen "Harvest+" direction). A trailing stack
 * of monthly columns — spending on the bottom, saving stacked above — with a
 * **canopy** trend line joining the stack tops: savings is the thing that visibly
 * grows, climbing over spend toward a dashed "plan" line (the month's total caps
 * + goals). It expresses the product's job in one glance: progress against
 * Targets, over time.
 *
 * Columns grow up from the soil line on load (`.growth-column`, curtailed by the
 * global reduced-motion layer). Each month is explorable: hovering or
 * keyboard-focusing a column reveals its spent/saved, and Escape dismisses it.
 * Every hit target carries an aria-label with the same figures, so screen-reader
 * users get the data without the visual tooltip (WCAG 1.4.13).
 *
 * The `viewBox` scales the whole chart to its container, so it stays crisp from
 * 390px to desktop. Signed monthly sums can go negative (a refund- or
 * withdrawal-heavy month); heights clamp at zero so a net-negative month simply
 * shows no column rather than an inverted one.
 */
const W = 640;
const H = 232;
const PAD = { l: 16, r: 16, t: 34, b: 26 };
const GAP = 3; // px between the spent and saved segments of a stack

export function GrowthColumns({
  data,
  plan,
}: {
  data: MonthlyTrendPoint[];
  plan: number;
}) {
  const [active, setActive] = useState<number | null>(null);
  const [wrapW, setWrapW] = useState(W);
  const wrapRef = useRef<HTMLDivElement>(null);
  // Measure the wrap on interaction (never during render — refs aren't
  // render-safe) so the tooltip's pixel clamp uses the real container width.
  const activate = (i: number) => {
    if (wrapRef.current) setWrapW(wrapRef.current.clientWidth);
    setActive(i);
  };

  const innerW = W - PAD.l - PAD.r;
  const innerH = H - PAD.t - PAD.b;
  const baseline = PAD.t + innerH;

  // 20% headroom above the tallest stack (or the plan line) so neither the
  // dashed plan line nor the canopy sits flush to the top edge.
  const stacked = data.map((d) => Math.max(0, d.spent) + Math.max(0, d.saved));
  const yScale = linearScale(domainMax([...stacked, plan], { headroom: 0.2 }), innerH);
  const xBand = bandScale(data.length, innerW, PAD.l);
  const barW = Math.min(46, xBand.slot * 0.5);
  const planY = baseline - yScale.length(plan);

  const cols = data.map((d, i) => {
    const cx = xBand.center(i);
    const spentH = yScale.length(d.spent);
    const savedH = yScale.length(d.saved);
    const spentY = baseline - spentH;
    // Stack saved above spent, with a small gap only when both segments are
    // present so single-segment months sit flat on the baseline.
    const savedBase = spentH > 0.5 ? spentY - GAP : baseline;
    const savedY = savedBase - savedH;
    // Top of whatever is drawn — where the canopy point and the tooltip sit.
    const topY = savedH > 0.5 ? savedY : spentH > 0.5 ? spentY : baseline;
    return { d, i, cx, spentH, savedH, spentY, savedY, topY };
  });

  // The canopy is literally the savings line, so it only touches months that
  // actually saved — an in-progress or spend-only month has no point rather than
  // a misleading plunge to the soil. Every vertex is an equal dot; there is no
  // distinguished "tip" marker (the bold latest-month label carries that).
  const savedCols = cols.filter((c) => c.savedH > 0.5);
  const canopy = savedCols.map((c) => `${c.cx.toFixed(1)},${c.savedY.toFixed(1)}`).join(" ");
  const clear = (i: number) => setActive((a) => (a === i ? null : a));
  const latest = cols[cols.length - 1];

  // The outer summary enumerates every month, so the full series reaches
  // assistive tech from one atomic read — independent of whether AT surfaces the
  // per-column controls nested inside this graphic.
  const ariaLabel = latest
    ? `Spending and saving over the last ${data.length} months. ` +
      data
        .map(
          (d) =>
            `${monthLabelShort(d.ym)}: spent ${fmt(Math.max(0, d.spent))}, saved ${fmt(Math.max(0, d.saved))}`,
        )
        .join("; ") +
      "." +
      (plan > 0 ? ` Monthly plan ${fmt(plan)}.` : "")
    : "No spending or saving data yet.";

  return (
    <section
      aria-labelledby="growth-columns-title"
      className="rounded-3xl bg-card p-5 ring-1 ring-border sm:p-6"
    >
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div>
          <h2
            id="growth-columns-title"
            className="font-heading text-xl font-semibold tracking-tight"
          >
            Momentum
          </h2>
          <p className="text-sm text-muted-foreground">
            Savings climbing over spending
            {plan > 0 ? ` · ${fmt(plan)}/mo plan` : ""}
          </p>
        </div>
        {/* Swatches use the identity chart tokens (chart-1/chart-2), not the
            status signal tokens — these columns encode series, not good/bad. */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span aria-hidden className="size-2.5 rounded-[3px] bg-chart-1" />
            Spent
          </span>
          <span className="flex items-center gap-1.5">
            <span aria-hidden className="size-2.5 rounded-[3px] bg-chart-2" />
            Saved (canopy)
          </span>
        </div>
      </div>

      <div className="relative" ref={wrapRef}>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={ariaLabel}>
          {/* soil line the columns rise from */}
          <line
            x1={PAD.l}
            x2={W - PAD.r}
            y1={baseline}
            y2={baseline}
            className="stroke-border"
            strokeWidth={2}
          />

          {plan > 0 && (
            <>
              <line
                x1={PAD.l}
                x2={W - PAD.r}
                y1={planY}
                y2={planY}
                className="stroke-muted-foreground"
                strokeWidth={1.5}
                strokeDasharray="5 5"
                strokeOpacity={0.55}
              />
              <text
                x={PAD.l}
                y={planY - 6}
                textAnchor="start"
                className="fill-muted-foreground text-[11px]"
              >
                plan {fmt(plan)}
              </text>
            </>
          )}

          {/* faint backdrop behind the active column (emphasis by highlight, not
              by dimming the others — the trend reads at full strength) */}
          {active !== null && (
            <rect
              x={cols[active].cx - xBand.slot / 2 + 2}
              y={PAD.t - 8}
              width={xBand.slot - 4}
              height={baseline - (PAD.t - 8)}
              rx={12}
              className="fill-accent"
            />
          )}

          {/* columns grow up from the soil */}
          {cols.map((c) => (
            <g
              key={c.d.ym}
              className="growth-column"
              style={{ animationDelay: `${c.i * 70}ms` }}
            >
              {c.spentH > 0.5 && (
                <rect x={c.cx - barW / 2} y={c.spentY} width={barW} height={c.spentH} rx={6} className="fill-chart-1" />
              )}
              {c.savedH > 0.5 && (
                <rect x={c.cx - barW / 2} y={c.savedY} width={barW} height={c.savedH} rx={6} className="fill-chart-2" />
              )}
            </g>
          ))}

          {/* canopy trend line — savings is the thing that grows */}
          {savedCols.length > 1 && (
            <polyline
              points={canopy}
              fill="none"
              className="stroke-chart-2"
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          )}
          {savedCols.map((c) => (
            <circle key={c.d.ym} cx={c.cx} cy={c.savedY} r={2.5} className="fill-chart-2" />
          ))}

          {/* month labels (outside the animated groups so they don't scale) */}
          {cols.map((c) => {
            const emphasized = active === c.i || (active === null && c.i === cols.length - 1);
            return (
              <text
                key={c.d.ym}
                x={c.cx}
                y={H - 8}
                textAnchor="middle"
                className={
                  (active === c.i ? "fill-foreground" : "fill-muted-foreground") +
                  " text-[11px]" +
                  (emphasized ? " font-semibold" : "")
                }
              >
                {monthLabelShort(c.d.ym)}
              </text>
            );
          })}

          {/* Per-month controls. role="button" (not "img") so AT announces them
              as the focusable, dismissable controls they are rather than nested
              graphics that an atomic role="img" ancestor could swallow. The full
              series is also in the outer summary, so the data reaches AT either
              way. */}
          {cols.map((c) => (
            <rect
              key={c.d.ym}
              x={PAD.l + xBand.slot * c.i}
              y={PAD.t - 8}
              width={xBand.slot}
              height={baseline - (PAD.t - 8)}
              fill="transparent"
              tabIndex={0}
              role="button"
              aria-label={`${monthLabelShort(c.d.ym)} — spent ${fmt(Math.max(0, c.d.spent))}, saved ${fmt(Math.max(0, c.d.saved))}`}
              className="cursor-default outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
              onMouseEnter={() => activate(c.i)}
              onMouseLeave={() => clear(c.i)}
              onFocus={() => activate(c.i)}
              onBlur={() => clear(c.i)}
              onKeyDown={(e) => {
                if (e.key === "Escape") setActive(null);
              }}
            />
          ))}
        </svg>

        {active !== null && (() => {
          // Clamp in pixels against the measured wrap so the fixed-width tooltip
          // never spills past the card edge — a percentage clamp can't account
          // for the tooltip's own width on a narrow (mobile) container, which
          // pushed it off-screen at the leftmost/rightmost columns.
          const TIP_W = 160; // fixed w-40 so the clamp math is exact
          const EDGE = 4; // min gap from the wrap edge
          const anchorPx = (cols[active].cx / W) * wrapW;
          // Clamp the tooltip's *left edge* directly (no centering translate to
          // double-count): centered on the column in the middle, pinned inside
          // the wrap at the extremes.
          const leftPx = Math.min(
            Math.max(anchorPx - TIP_W / 2, EDGE),
            wrapW - TIP_W - EDGE,
          );
          return (
          <div
            role="presentation"
            className="pointer-events-none absolute z-10 w-40 rounded-xl bg-popover p-3 text-popover-foreground shadow-lg ring-1 ring-border"
            style={{
              left: leftPx,
              top: `${(cols[active].topY / H) * 100}%`,
              transform: "translateY(calc(-100% - 10px))",
            }}
          >
            <div className="font-heading text-sm font-semibold">
              {monthLabelShort(cols[active].d.ym)}
            </div>
            <div className="mt-1.5 flex justify-between gap-6 text-xs">
              <span className="text-muted-foreground">Spent</span>
              <span className="font-medium tabular-nums text-chart-1">
                {fmt(Math.max(0, cols[active].d.spent))}
              </span>
            </div>
            <div className="mt-0.5 flex justify-between gap-6 text-xs">
              <span className="text-muted-foreground">Saved</span>
              <span className="font-medium tabular-nums text-chart-2">
                {fmt(Math.max(0, cols[active].d.saved))}
              </span>
            </div>
          </div>
          );
        })()}
      </div>
    </section>
  );
}
