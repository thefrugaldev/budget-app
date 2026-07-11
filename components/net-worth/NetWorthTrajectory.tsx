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
 * A11y (story 22): the chart is a labeled `role="img"` carrying a concise trend
 * summary, and the full per-month data is reachable as text through the
 * visually-hidden data table — a navigable alternative that scales to a long
 * history better than one enumerated label. Assumes a non-empty series; the page
 * omits the card entirely when there's no recorded history yet.
 */
export function NetWorthTrajectory({ series }: { series: NetWorthPoint[] }) {
  const first = series[0];
  const last = series[series.length - 1];
  const points = series.map((p) => ({ label: monthLabelShort(p.ym), value: p.net }));

  // The direction is spoken as a word ("up"/"down"/"flat"), never conveyed by
  // the line's slope alone — the a11y baseline's "never state by color/shape
  // alone" rule applied to a trend.
  const summary =
    series.length === 1
      ? `Net worth trajectory: ${fmt(first.net)} recorded in ${monthLabel(first.ym)}.`
      : `Net worth trajectory over ${series.length} months, ${trendWord(last.net - first.net)} from ` +
        `${fmt(first.net)} in ${monthLabel(first.ym)} to ${fmt(last.net)} in ${monthLabel(last.ym)}.`;

  return (
    <section
      aria-labelledby="nw-trajectory-title"
      className="rounded-3xl bg-card p-5 ring-1 ring-border sm:p-6"
    >
      <div className="mb-4">
        <h2 id="nw-trajectory-title" className="font-heading text-xl font-semibold tracking-tight">
          Trajectory
        </h2>
        <p className="text-sm text-muted-foreground">Recorded net worth, month by month</p>
      </div>

      <LineChart points={points} area ariaLabel={summary} />

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
    </section>
  );
}

function trendWord(delta: number): string {
  if (delta > 0) return "up";
  if (delta < 0) return "down";
  return "flat";
}
