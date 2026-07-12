import { describe, expect, it } from "vitest";

import type { NetWorthPoint } from "@/types/net-worth";
import type { ResolvedAssumptions } from "@/types/fire";

import { buildProjectionChart } from "./chart";

const base: ResolvedAssumptions = {
  monthlyRetirementSpend: 4000,
  monthlyContribution: 2000,
  nominalReturn: 7,
  inflation: 3,
  safeWithdrawalRate: 4,
  traditionalRetirementAge: 65,
  birthYear: 1990,
};
const today = new Date(Date.UTC(2026, 6, 15)); // 2026-07

const history: NetWorthPoint[] = [
  { ym: "2026-04", net: 280_000 },
  { ym: "2026-05", net: 290_000 },
  { ym: "2026-06", net: 300_000 },
];

describe("buildProjectionChart", () => {
  it("stitches recorded history (before now) into the projected curve", () => {
    const chart = buildProjectionChart(base, 305_000, history, today);

    // All three history months precede 2026-07, so all are recorded.
    expect(chart.firstProjectedIndex).toBe(3);
    const recorded = chart.points.slice(0, chart.firstProjectedIndex);
    const projected = chart.points.slice(chart.firstProjectedIndex);
    expect(recorded.every((p) => !p.projected)).toBe(true);
    expect(projected.every((p) => p.projected)).toBe(true);

    // The projection owns "now": its first point is this month at the live nest egg.
    expect(projected[0]).toEqual({ ym: "2026-07", value: 305_000, projected: true });
    // Points are in time order across the junction.
    expect(recorded.at(-1)!.ym).toBe("2026-06");
  });

  it("drops history dated this month or later so the live figure isn't shadowed", () => {
    // A snapshot recorded in the current (or a future) month must not become a
    // recorded point — the projection's live-priced "now" owns that column.
    const withNow: NetWorthPoint[] = [...history, { ym: "2026-07", net: 999_999 }];
    const chart = buildProjectionChart(base, 305_000, withNow, today);
    expect(chart.firstProjectedIndex).toBe(3); // still just the three prior months
    expect(chart.points[3]).toEqual({ ym: "2026-07", value: 305_000, projected: true });
  });

  it("marks the FIRE crossing at a real projected point", () => {
    const chart = buildProjectionChart(base, 305_000, history, today);
    expect(chart.fireNumber).toBeCloseTo(1_200_000, 0); // 48k / 0.04
    expect(chart.fireCrossingYm).not.toBeNull();
    // The crossing month is one of the projected points.
    expect(chart.points.some((p) => p.projected && p.ym === chart.fireCrossingYm)).toBe(true);
    // ...and it's the first projected month at or above the FIRE number.
    const crossing = chart.points.find((p) => p.ym === chart.fireCrossingYm)!;
    expect(crossing.value).toBeGreaterThanOrEqual(chart.fireNumber!);
  });

  it("withholds the coast line and reports year-only axis until a birth year is set", () => {
    const chart = buildProjectionChart({ ...base, birthYear: null }, 305_000, history, today);
    expect(chart.birthYear).toBeNull();
    expect(chart.coastNumber).toBeNull();
    expect(chart.coastCrossingYm).toBeNull();
    // The FIRE line and curve still draw — they don't need a birth year.
    expect(chart.fireNumber).toBeCloseTo(1_200_000, 0);
    expect(chart.points.length).toBeGreaterThan(0);
  });

  it("gives the coast line and crossing once a birth year is set", () => {
    const chart = buildProjectionChart(base, 305_000, history, today);
    expect(chart.coastNumber).not.toBeNull();
    expect(chart.coastNumber!).toBeLessThan(chart.fireNumber!); // coast < FIRE at a positive real rate
    expect(chart.coastCrossingYm).not.toBeNull();
  });

  it("draws no FIRE line and no crossing when there's no finite target (SWR 0)", () => {
    const chart = buildProjectionChart({ ...base, safeWithdrawalRate: 0 }, 305_000, history, today);
    expect(chart.fireNumber).toBeNull();
    expect(chart.fireCrossingYm).toBeNull();
  });

  it("renders projection-only (no recorded segment) when there's no history", () => {
    const chart = buildProjectionChart(base, 305_000, [], today);
    expect(chart.firstProjectedIndex).toBe(0);
    expect(chart.points.every((p) => p.projected)).toBe(true);
    expect(chart.points[0].ym).toBe("2026-07");
  });

  it("leaves an unreachable FIRE crossing null without capping the horizon short", () => {
    // Zero contribution and a nest egg far below target: with a positive real
    // rate it eventually compounds up, but not within a 60-year ceiling.
    const chart = buildProjectionChart(
      { ...base, monthlyContribution: 0 },
      1_000,
      history,
      today,
    );
    expect(chart.fireCrossingYm).toBeNull();
    // The FIRE line is still shown so the gap-to-target reads honestly.
    expect(chart.fireNumber).not.toBeNull();
  });
});
