"use client";

import { Minus, TrendingDown, TrendingUp } from "lucide-react";
import { useState } from "react";

import { LineChart } from "@/components/charts/LineChart";
import { fmt, monthLabel, monthLabelShort } from "@/lib/budget";
import { cn } from "@/lib/utils";
import type { NetWorthPoint } from "@/types/net-worth";

/**
 * The Net Worth trajectory (#109 chunk 9, story 9): recorded monthly history as
 * an *analytical* line chart, not a decorative sparkline. Its job is to let you
 * answer, at a glance, "how much did I gain over this window?" and, on demand,
 * "what happened month over month?" — so it leads with a **change** figure (the
 * page hero already owns the current absolute), scopes to a window (YTD / 12M /
 * All), and every point reveals its value and month-over-month delta on hover or
 * keyboard focus.
 *
 * This is *recorded* history — the points you checked in — deliberately distinct
 * from the live headline that moves with the market (story 11 / ADR 0003), and
 * carry-forward keeps a skipped month from cratering the line (story 10, handled
 * upstream). Below two recorded months there's no trajectory to draw, so it
 * invites the next check-in instead of rendering a degenerate one-point line.
 *
 * A11y (story 22): the change carries a direction word for screen readers (not
 * color/arrow alone); the chart is a labelled `role="img"` with focusable,
 * individually-labelled points; and the visible series is mirrored in a
 * visually-hidden data table.
 */
type Range = "ytd" | "12m" | "all";
const RANGES: { key: Range; label: string }[] = [
  { key: "ytd", label: "YTD" },
  { key: "12m", label: "12M" },
  { key: "all", label: "All" },
];

export function NetWorthTrajectory({
  series,
  currentYm,
}: {
  series: NetWorthPoint[];
  currentYm: string;
}) {
  const [range, setRange] = useState<Range>("12m");
  if (series.length === 0) return null;

  const enoughForChart = series.length >= 2;
  const visible = enoughForChart ? sliceByRange(series, range, currentYm) : series;
  const hasTrend = enoughForChart && visible.length >= 2;

  // Change over the visible window. Computed unconditionally (harmless on a
  // one-point window: first === last, change 0); only rendered when `hasTrend`.
  const first = visible[0];
  const last = visible[visible.length - 1];
  const change = last.net - first.net;
  const pct = first.net > 0 ? (change / first.net) * 100 : null;
  const dir = change > 0 ? "up" : change < 0 ? "down" : "flat";
  const TrendIcon = dir === "up" ? TrendingUp : dir === "down" ? TrendingDown : Minus;
  const signalClass =
    dir === "up"
      ? "text-signal-good-foreground"
      : dir === "down"
        ? "text-signal-bad-foreground"
        : "text-muted-foreground";
  const sign = change >= 0 ? "+" : "−";
  const pctLabel =
    pct === null ? null : `${sign}${Math.abs(pct).toFixed(Math.abs(pct) < 10 ? 1 : 0)}%`;
  const dirWord = dir === "up" ? "Up" : dir === "down" ? "Down" : "No change,";
  const summary =
    `Net worth trajectory over ${visible.length} months, ${dir} from ` +
    `${fmt(first.net)} in ${monthLabel(first.ym)} to ${fmt(last.net)} in ${monthLabel(last.ym)}.`;

  return (
    <section
      aria-labelledby="nw-trajectory-title"
      className="rounded-3xl bg-card p-5 ring-1 ring-border sm:p-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="nw-trajectory-title" className="font-heading text-xl font-semibold tracking-tight">
          Trajectory
        </h2>
        {enoughForChart && (
          <div role="group" aria-label="Time range" className="flex items-center gap-1">
            {RANGES.map((r) => (
              <button
                key={r.key}
                type="button"
                aria-pressed={range === r.key}
                onClick={() => setRange(r.key)}
                className={cn(
                  "rounded-full px-2.5 py-1 text-xs font-medium ring-1 transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  range === r.key
                    ? "bg-foreground text-background ring-foreground"
                    : "bg-card text-muted-foreground ring-border hover:text-foreground",
                )}
              >
                {r.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {!enoughForChart ? (
        <div className="mt-3">
          <p className="text-2xl font-semibold tabular-nums">{fmt(first.net)}</p>
          <p className="mt-1 max-w-prose text-sm text-muted-foreground">
            Your first recorded check-in, {monthLabel(first.ym)}. Record again next month and this
            becomes a trend line.
          </p>
        </div>
      ) : !hasTrend ? (
        <p className="mt-3 text-sm text-muted-foreground">
          Only one month recorded in this range. Switch to 12M or All to see the trend.
        </p>
      ) : (
        <>
          <div className="mt-2 mb-4">
            <div className={cn("flex items-center gap-2", signalClass)}>
              <TrendIcon aria-hidden className="size-5 shrink-0" />
              <span className="sr-only">{dirWord} </span>
              <span className="text-2xl font-semibold tabular-nums">
                {sign}
                {fmt(Math.abs(change))}
              </span>
              {pctLabel && <span className="text-base font-medium tabular-nums">{pctLabel}</span>}
            </div>
            <p className="mt-0.5 text-sm text-muted-foreground">since {monthLabel(first.ym)}</p>
          </div>

          <LineChart
            points={visible.map((p) => ({ label: monthLabelShort(p.ym), value: p.net }))}
            baseline="fit"
            area
            ariaLabel={summary}
            formatPoint={(_point, i) => {
              const p = visible[i];
              const prev = visible[i - 1];
              // Row 1: the month and what it was worth. Row 2 (below): the change.
              const title = `${monthLabel(p.ym)} · ${fmt(p.net)}`;
              if (!prev) return { title, detail: "First recorded month" };
              const mom = p.net - prev.net;
              const msign = mom >= 0 ? "+" : "−";
              const mpct =
                prev.net > 0 ? ` (${msign}${Math.abs((mom / prev.net) * 100).toFixed(0)}%)` : "";
              // Up is good, down is bad — same mapping as the change headline; the
              // sign carries direction as text, so color is enhancement, not the
              // only cue. Flat stays muted.
              const tone =
                mom > 0
                  ? "text-signal-good-foreground"
                  : mom < 0
                    ? "text-signal-bad-foreground"
                    : undefined;
              return {
                title,
                detail: `${msign}${fmt(Math.abs(mom))}${mpct} vs ${monthLabelShort(prev.ym)}`,
                detailClassName: tone,
              };
            }}
          />

          {/* The chart's data as text (story 22): a navigable table for screen
              readers, mirroring the visible window. */}
          <table className="sr-only">
            <caption>Recorded net worth by month</caption>
            <thead>
              <tr>
                <th scope="col">Month</th>
                <th scope="col">Net worth</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((p) => (
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

// Scope the series to a window. "12m" is the trailing twelve recorded points;
// "ytd" is the current calendar year (by `currentYm`, passed from the server so
// the year boundary doesn't depend on the client-vs-server clock); "all" is whole.
function sliceByRange(series: NetWorthPoint[], range: Range, currentYm: string): NetWorthPoint[] {
  if (range === "all") return series;
  if (range === "12m") return series.slice(-12);
  const year = currentYm.slice(0, 4);
  return series.filter((p) => p.ym.slice(0, 4) === year);
}
