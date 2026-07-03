import { fmt, monthLabelShort } from "@/lib/budget";
import type { MonthlyTrendPoint } from "@/types/budget";

/**
 * The Pulse signature (#80 chunk 5, "Growth Columns"). A trailing stack of
 * monthly columns — spending on the bottom, saving stacked above — climbing
 * toward a dashed "plan" line (the month's total caps + goals). It expresses
 * the product's job: progress against Targets, over time, in one glance.
 *
 * Rendered server-side as static SVG (no client JS): the `viewBox` scales the
 * whole chart to its container, so it stays crisp from 390px to desktop. The
 * legend labels the two series in text, so the good/save reading never depends
 * on color alone. Signed monthly sums can go negative (a refund- or
 * withdrawal-heavy month); bar heights clamp at zero so a net-negative month
 * simply shows no column rather than an inverted one.
 */
const W = 640;
const H = 220;
const PAD = { l: 16, r: 16, t: 30, b: 26 };
const GAP = 3; // px between the spent and saved segments of a stack

export function GrowthColumns({
  data,
  plan,
}: {
  data: MonthlyTrendPoint[];
  plan: number;
}) {
  const innerW = W - PAD.l - PAD.r;
  const innerH = H - PAD.t - PAD.b;
  const baseline = PAD.t + innerH;
  const slot = innerW / Math.max(1, data.length);
  const barW = Math.min(46, slot * 0.5);

  const stacked = data.map((d) => Math.max(0, d.spent) + Math.max(0, d.saved));
  const domain = Math.max(...stacked, plan, 1) * 1.15;
  const h = (v: number) => (Math.max(0, v) / domain) * innerH;
  const planY = baseline - h(plan);

  const latest = data[data.length - 1];
  const ariaLabel = latest
    ? `Spending and saving over the last ${data.length} months, ending ${monthLabelShort(latest.ym)}.` +
      ` This month: spent ${fmt(Math.max(0, latest.spent))}, saved ${fmt(Math.max(0, latest.saved))}.` +
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
            Spending and saving over the last {data.length} months
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
            Saved
          </span>
        </div>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        role="img"
        aria-label={ariaLabel}
      >
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
              x={W - PAD.r}
              y={planY - 6}
              textAnchor="end"
              className="fill-muted-foreground text-[11px]"
            >
              plan {fmt(plan)}
            </text>
          </>
        )}

        {data.map((d, i) => {
          const cx = PAD.l + slot * i + slot / 2;
          const x = cx - barW / 2;
          const spentH = h(d.spent);
          const savedH = h(d.saved);
          const spentY = baseline - spentH;
          // Stack saved above spent, with a small gap only when both segments
          // are present so single-segment months sit flat on the baseline.
          const savedBase = spentH > 0.5 ? spentY - GAP : baseline;
          const savedY = savedBase - savedH;
          const last = i === data.length - 1;
          const op = last ? 1 : 0.82;
          return (
            <g key={d.ym}>
              {spentH > 0.5 && (
                <rect
                  x={x}
                  y={spentY}
                  width={barW}
                  height={spentH}
                  rx={6}
                  className="fill-chart-1"
                  opacity={op}
                />
              )}
              {savedH > 0.5 && (
                <rect
                  x={x}
                  y={savedY}
                  width={barW}
                  height={savedH}
                  rx={6}
                  className="fill-chart-2"
                  opacity={op}
                />
              )}
              <text
                x={cx}
                y={H - 8}
                textAnchor="middle"
                className={
                  "fill-muted-foreground text-[11px] " +
                  (last ? "font-semibold opacity-100" : "opacity-70")
                }
              >
                {monthLabelShort(d.ym)}
              </text>
            </g>
          );
        })}
      </svg>
    </section>
  );
}
