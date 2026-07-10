import { describe, expect, it } from "vitest";

import type { Account, Snapshot } from "@/types/net-worth";

import { latestSnapshotDates, monthlyNetWorthSeries } from "./series";

function account(over: Partial<Account> & Pick<Account, "id" | "class">): Account {
  return { name: over.name ?? over.id, ...over };
}

describe("monthlyNetWorthSeries", () => {
  it("returns an empty series when there are no snapshots", () => {
    expect(monthlyNetWorthSeries([account({ id: "a", class: "asset" })], [])).toEqual([]);
  });

  it("produces one point per recorded month for a single account", () => {
    const accounts = [account({ id: "hysa", class: "asset" })];
    const snapshots: Snapshot[] = [
      { accountId: "hysa", date: "2026-01-15", value: 10_000 },
      { accountId: "hysa", date: "2026-02-15", value: 11_000 },
    ];
    expect(monthlyNetWorthSeries(accounts, snapshots)).toEqual([
      { ym: "2026-01", net: 10_000 },
      { ym: "2026-02", net: 11_000 },
    ]);
  });

  it("carries a skipped month forward from the last recorded snapshot", () => {
    const accounts = [account({ id: "hysa", class: "asset" })];
    const snapshots: Snapshot[] = [
      { accountId: "hysa", date: "2026-01-15", value: 10_000 },
      // Feb skipped
      { accountId: "hysa", date: "2026-03-15", value: 12_000 },
    ];
    expect(monthlyNetWorthSeries(accounts, snapshots)).toEqual([
      { ym: "2026-01", net: 10_000 },
      { ym: "2026-02", net: 10_000 }, // carried forward, not a gap
      { ym: "2026-03", net: 12_000 },
    ]);
  });

  it("nets accounts by class — assets minus liabilities — with per-account carry-forward", () => {
    const accounts = [
      account({ id: "hysa", class: "asset" }),
      account({ id: "mortgage", class: "liability" }),
    ];
    const snapshots: Snapshot[] = [
      { accountId: "hysa", date: "2026-01-31", value: 500_000 },
      { accountId: "mortgage", date: "2026-01-31", value: 300_000 },
      // Feb: only the mortgage is updated; the asset carries forward.
      { accountId: "mortgage", date: "2026-02-28", value: 297_000 },
    ];
    expect(monthlyNetWorthSeries(accounts, snapshots)).toEqual([
      { ym: "2026-01", net: 200_000 },
      { ym: "2026-02", net: 203_000 }, // 500_000 (carried) − 297_000
    ]);
  });

  it("does not credit an account before its first snapshot", () => {
    const accounts = [
      account({ id: "hysa", class: "asset" }),
      account({ id: "brk", class: "asset" }),
    ];
    const snapshots: Snapshot[] = [
      { accountId: "hysa", date: "2026-01-31", value: 10_000 },
      // brk opened later — no January snapshot
      { accountId: "brk", date: "2026-02-28", value: 5_000 },
    ];
    expect(monthlyNetWorthSeries(accounts, snapshots)).toEqual([
      { ym: "2026-01", net: 10_000 }, // brk not yet counted
      { ym: "2026-02", net: 15_000 },
    ]);
  });

  // The closed-account contract has two sides (see monthlyNetWorthSeries' doc):
  // history is defined purely over snapshots, so closing zeroes an account out
  // only via the final value:0 snapshot the chunk-2 write path records — this
  // function never reads `closedAt`. These two tests pin both sides.

  it("keeps a closed account's history and zeroes it out from its closing snapshot", () => {
    const accounts = [
      account({ id: "hysa", class: "asset" }),
      account({ id: "car", class: "asset", closedAt: "2026-02-28" }),
    ];
    const snapshots: Snapshot[] = [
      { accountId: "hysa", date: "2026-01-31", value: 10_000 },
      { accountId: "car", date: "2026-01-31", value: 8_000 },
      // Car sold in Feb: closing zero snapshot; hysa carries forward.
      { accountId: "car", date: "2026-02-28", value: 0 },
    ];
    expect(monthlyNetWorthSeries(accounts, snapshots)).toEqual([
      { ym: "2026-01", net: 18_000 }, // car still contributes its history
      { ym: "2026-02", net: 10_000 }, // car zeroed by its closing snapshot
    ]);
  });

  it("carries a closed account forward when the write path omitted the closing zero snapshot (chunk-2 invariant)", () => {
    // Documents the dependency: `closedAt` alone does NOT zero the series —
    // absent the value:0 closing snapshot, the last recorded value carries
    // forward. This is why persisting that snapshot is a chunk-2 write invariant.
    const accounts = [
      account({ id: "hysa", class: "asset" }),
      account({ id: "car", class: "asset", closedAt: "2026-02-15" }),
    ];
    const snapshots: Snapshot[] = [
      { accountId: "hysa", date: "2026-01-31", value: 10_000 },
      { accountId: "car", date: "2026-01-31", value: 8_000 },
      { accountId: "hysa", date: "2026-03-31", value: 10_500 },
      // No closing snapshot for `car`.
    ];
    expect(monthlyNetWorthSeries(accounts, snapshots)).toEqual([
      { ym: "2026-01", net: 18_000 },
      { ym: "2026-02", net: 18_000 }, // car's 8_000 carried forward despite closedAt
      { ym: "2026-03", net: 18_500 },
    ]);
  });
});

describe("latestSnapshotDates", () => {
  it("returns the most recent date per account", () => {
    const snapshots: Snapshot[] = [
      { accountId: "a", date: "2026-01-31", value: 1 },
      { accountId: "a", date: "2026-03-31", value: 3 },
      { accountId: "a", date: "2026-02-28", value: 2 },
      { accountId: "b", date: "2026-02-28", value: 9 },
    ];
    expect(latestSnapshotDates(snapshots)).toEqual(
      new Map([
        ["a", "2026-03-31"],
        ["b", "2026-02-28"],
      ]),
    );
  });

  it("is empty for no snapshots (a never-checked-in account is simply absent)", () => {
    expect(latestSnapshotDates([])).toEqual(new Map());
  });
});
