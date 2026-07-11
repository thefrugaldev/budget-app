import { LineChart } from "@/components/charts/LineChart";
import { fmt, monthLabel, monthLabelShort } from "@/lib/budget";
import type { NetWorthPoint } from "@/types/net-worth";

/**
 * The Net Worth trajectory (#109 chunk 9, story 9): the recorded monthly series
 * drawn as the shared area/line chart, in a Harvest card. This is *recorded*
 * history — the points you checked in — deliberately distinct from the live
 * headline that moves with the market (story 11 / ADR 0003). A skipped month
 * carries the last recorded value forward, so the line never craters (story 10,
 * handled upstream in `monthlyNetWorthSeries`).
 *
 * A single recorded month is **not** a trajectory — one vertex on an empty plot
 * reads as broken — so below two points we show the figure and invite the next
 * check-in instead of drawing a degenerate line. The chart (and its text
 * alternative) appears once there are at least two months to connect.
 *
 * A11y (story 22): the chart is a labeled `role="img"` carrying a concise trend
 * summary, and the full per-month data is reachable as text through the
 * visually-hidden data table — a navigable alternative that scales to a long
 * history better than one enumerated label.
 */
export function NetWorthTrajectory({ series }: { series: NetWorthPoint[] }) {
  if (series.length === 0) return null;

  const first = series[0];
  const last = series[series.length - 1];

  return (
    <section
      aria-labelledby="nw-trajectory-title"
      className="rounded-3xl bg-card p-5 ring-1 ring-border sm:p-6"
    >
      <h2 id="nw-trajectory-title" className="font-heading text-xl font-semibold tracking-tight">
        Trajectory
      </h2>

      {series.length < 2 ? (
        <div className="mt-3">
          <p className="text-2xl font-semibold tabular-nums">{fmt(first.net)}</p>
          <p className="mt-1 max-w-prose text-sm text-muted-foreground">
            Your first recorded check-in, {monthLabel(first.ym)}. Record again next month and this
            becomes a trend line.
          </p>
        </div>
      ) : (
        <>
          <p className="mt-0.5 mb-4 text-sm text-muted-foreground">
            Recorded net worth, month by month
          </p>

          <LineChart
            points={series.map((p) => ({ label: monthLabelShort(p.ym), value: p.net }))}
            area
            // The direction is spoken as a word ("up"/"down"/"flat"), never left
            // to the line's slope alone — the a11y "never by shape/color alone"
            // rule applied to a trend.
            ariaLabel={
              `Net worth trajectory over ${series.length} months, ${trendWord(last.net - first.net)} ` +
              `from ${fmt(first.net)} in ${monthLabel(first.ym)} to ${fmt(last.net)} in ${monthLabel(last.ym)}.`
            }
          />

          {/* The chart's data as text (story 22): a navigable table for screen
              readers, kept out of the visual layout. */}
          <table className="sr-only">
            <caption>Recorded net worth by month</caption>
            <thead>
              <tr>
                <th scope="col">Month</th>
                <th scope="col">Net worth</th>
              </tr>
            </thead>
            <tbody>
              {series.map((p) => (
                <tr key={p.ym}>
                  <th scope="row">{monthLabel(p.ym)}</th>
                  <td>{fmt(p.net)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </section>
  );
}

function trendWord(delta: number): string {
  if (delta > 0) return "up";
  if (delta < 0) return "down";
  return "flat";
}
