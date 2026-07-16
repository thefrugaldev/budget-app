import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { startMemoryMongo, type MemoryMongo } from "../../test/memory-mongo";
import { applyManifests, readManifests, resolveHouseholdId, runApply } from "./apply";
import { buildExtract } from "./build-manifest";
import {
  buildFixtureWorkbook,
  fixtureIncome,
  fixtureMapping,
  fixtureOverrides,
} from "./fixtures/build-fixture-workbook";
import { readWorkbookBuffer } from "./workbook";
import type { ExtractResult } from "./manifest-types";

const HH = "hh1";
const NOW = new Date("2026-07-09T00:00:00Z");

async function fixtureExtract(): Promise<ExtractResult> {
  const wb = await readWorkbookBuffer(await buildFixtureWorkbook(), "2023.xlsx");
  return buildExtract({
    workbooks: [wb],
    mapping: fixtureMapping,
    overrides: fixtureOverrides,
    income: fixtureIncome,
  });
}

let mongo: MemoryMongo;
let result: ExtractResult;

/** A synthetic liability snapshot for the closed-detection / sweep tests. */
function liabSnap(
  importRef: string,
  liability: string,
  date: string,
  balance: number,
): ExtractResult["workbooks"][number]["liabilitySnapshots"][number] {
  return { _id: importRef, importRef, liability, date, balance };
}

/** Collections here use string `_id`s, not the driver's default ObjectId. */
function coll(name: string) {
  return mongo.db.collection<{ _id: string } & Record<string, unknown>>(name);
}

beforeAll(async () => {
  mongo = await startMemoryMongo();
  result = await fixtureExtract();
}, 60_000);
afterAll(async () => {
  await mongo?.stop();
});
beforeEach(async () => {
  await mongo.reset();
  await coll("households").insertOne({ _id: HH, createdAt: NOW });
});

function apply(opts: { dryRun?: boolean; workbooks?: ExtractResult["workbooks"]; now?: Date } = {}) {
  return applyManifests({
    db: mongo.db,
    householdId: HH,
    categories: result.categories,
    workbooks: opts.workbooks ?? result.workbooks,
    dryRun: opts.dryRun ?? false,
    now: opts.now ?? NOW,
  });
}

describe("applyManifests — idempotent re-apply", () => {
  it("re-applies as pure updates and preserves createdAt", async () => {
    await apply({ now: NOW });
    const before = await coll("transactions").find({}).toArray();

    const later = new Date("2026-08-01T00:00:00Z");
    const report = await apply({ now: later });
    const txSync = report.syncs.find((s) => s.collection === "transactions" && s.scope === "2023.xlsx")!;
    expect(txSync.inserted).toBe(0);
    expect(txSync.updated).toBe(before.length);

    const after = await coll("transactions").findOne({ _id: before[0]._id });
    expect(after!.createdAt).toEqual(before[0].createdAt); // not churned to `later`
  });

  it("deletes orphaned imported docs when a line vanishes from the manifest", async () => {
    await apply();
    const before = await coll("transactions").countDocuments({ householdId: HH });

    const trimmed = [{ ...result.workbooks[0], transactions: result.workbooks[0].transactions.slice(0, -1) }];
    const report = await apply({ workbooks: trimmed });
    const txSync = report.syncs.find((s) => s.collection === "transactions" && s.scope === "2023.xlsx")!;
    expect(txSync.deletedOrphans).toBe(1);
    expect(await coll("transactions").countDocuments({ householdId: HH })).toBe(before - 1);
  });
});

describe("applyManifests — dry run", () => {
  it("reports the plan but writes nothing", async () => {
    const report = await apply({ dryRun: true });
    expect(report.syncs.find((s) => s.collection === "transactions")!.inserted).toBe(7);
    expect(await coll("transactions").countDocuments()).toBe(0);
    expect(await coll("categories").countDocuments({ importRef: { $exists: true } })).toBe(0);
  });

  it("does not write the auto-seed-disabled marker on a dry run", async () => {
    await apply({ dryRun: true });
    expect(await coll("meta").countDocuments({ _id: `autoSeedDisabled:${HH}` })).toBe(0);
  });
});

describe("applyManifests — auto-seed guard", () => {
  // Once real data is imported, a cold start must never back-fill the demo
  // dataset. A live apply writes the auto-seed-disabled marker so
  // `resolveSeedAction` returns "skip" rather than "backfill" (regression guard
  // for the removed --first-apply marker write, PR #169 review finding 2).
  it("writes the auto-seed-disabled marker on a live apply", async () => {
    await apply();
    expect(await coll("meta").countDocuments({ _id: `autoSeedDisabled:${HH}` })).toBe(1);
  });

  it("keeps the marker idempotent across re-applies", async () => {
    await apply();
    await apply();
    expect(await coll("meta").countDocuments({ _id: `autoSeedDisabled:${HH}` })).toBe(1);
  });
});

describe("applyManifests — liability accounts & snapshots", () => {
  it("derives one account per canonical liability with class/importRef/balance-from-latest", async () => {
    await apply();
    // The fixture's single Mortgage liability.
    const accounts = await coll("accounts").find({ householdId: HH }).toArray();
    expect(accounts).toHaveLength(1);
    const mortgage = accounts[0];
    expect(mortgage).toMatchObject({
      name: "Mortgage",
      class: "liability",
      importRef: "liability!account!Mortgage",
      balance: 299000, // the latest (February) balance
    });
    expect(mortgage.kind).toBeUndefined();
    expect(mortgage.closedAt).toBeUndefined(); // still the current liability

    // Snapshots point at the derived account and carry the balance as `value`.
    const snaps = await coll("snapshots").find({ householdId: HH }).sort({ date: 1 }).toArray();
    expect(snaps).toHaveLength(2);
    expect(snaps[0]).toMatchObject({ accountId: mortgage._id, date: "2023-01-31", value: 300000 });
    expect(typeof snaps[0].importRef).toBe("string");
  });

  it("marks a liability closed when its last snapshot predates the archive edge", async () => {
    // Two liabilities: 'Auto' ends in 2023, 'Home' continues into 2024.
    const workbooks: ExtractResult["workbooks"] = [
      {
        file: "2023.xlsx",
        transactions: [],
        estimateTargets: [],
        liabilitySnapshots: [
          liabSnap("2023.xlsx!DebtsEquity!B12", "Auto", "2023-12-31", 5000),
          liabSnap("2023.xlsx!DebtsEquity!C12", "Home", "2023-12-31", 250000),
        ],
      },
      {
        file: "2024.xlsx",
        transactions: [],
        estimateTargets: [],
        liabilitySnapshots: [
          liabSnap("2024.xlsx!DebtsEquity!B12", "Home", "2024-12-31", 240000),
        ],
      },
    ];
    await apply({ workbooks });

    const auto = await coll("accounts").findOne({ name: "Auto" });
    const home = await coll("accounts").findOne({ name: "Home" });
    expect(auto!.closedAt).toBe("2023-12-31"); // last snapshot before the edge
    expect(home!.closedAt).toBeUndefined(); // reaches the archive edge → open
    expect(home!.balance).toBe(240000); // latest snapshot balance
  });

  it("preserves a user-edited balance and derived closedAt across re-apply ($setOnInsert)", async () => {
    await apply();
    const mortgage = await coll("accounts").findOne({ name: "Mortgage" });

    // Simulate a post-cutover check-in editing the live balance.
    await coll("accounts").updateOne({ _id: mortgage!._id }, { $set: { balance: 111111 } });

    await apply(); // re-apply
    const after = await coll("accounts").findOne({ _id: mortgage!._id });
    expect(after!.balance).toBe(111111); // NOT clobbered back to the manifest balance
    expect(after!.name).toBe("Mortgage"); // identity fields still refreshed
  });

  it("advances an import-derived balance when a re-apply brings newer snapshots", async () => {
    // PR #159 finding 2: the pre-cutover re-run cadence — the growing workbook
    // adds months; nothing but apply ever touched the balance, so it must
    // follow the new latest snapshot rather than freeze at first insert.
    const v1: ExtractResult["workbooks"] = [{
      file: "2023.xlsx", transactions: [], estimateTargets: [],
      liabilitySnapshots: [
        liabSnap("2023.xlsx!DebtsEquity!B2", "Mortgage", "2023-01-31", 300000),
        liabSnap("2023.xlsx!DebtsEquity!B3", "Mortgage", "2023-02-28", 299000),
      ],
    }];
    const v2: ExtractResult["workbooks"] = [{
      ...v1[0],
      liabilitySnapshots: [
        ...v1[0].liabilitySnapshots,
        liabSnap("2023.xlsx!DebtsEquity!B4", "Mortgage", "2023-03-31", 298000),
      ],
    }];

    await apply({ workbooks: v1 });
    expect((await coll("accounts").findOne({ name: "Mortgage" }))!.balance).toBe(299000);

    await apply({ workbooks: v2 });
    expect((await coll("accounts").findOne({ name: "Mortgage" }))!.balance).toBe(298000);
  });

  it("leaves a user-edited balance alone even when newer snapshots arrive", async () => {
    const v1: ExtractResult["workbooks"] = [{
      file: "2023.xlsx", transactions: [], estimateTargets: [],
      liabilitySnapshots: [liabSnap("2023.xlsx!DebtsEquity!B2", "Mortgage", "2023-01-31", 300000)],
    }];
    const v2: ExtractResult["workbooks"] = [{
      ...v1[0],
      liabilitySnapshots: [
        ...v1[0].liabilitySnapshots,
        liabSnap("2023.xlsx!DebtsEquity!B3", "Mortgage", "2023-02-28", 299000),
      ],
    }];

    await apply({ workbooks: v1 });
    // A check-in/edit moves the balance off the import-derived value…
    await coll("accounts").updateOne({ name: "Mortgage" }, { $set: { balance: 111111 } });

    await apply({ workbooks: v2 });
    // …so the re-apply must not advance it, newer snapshots or not.
    expect((await coll("accounts").findOne({ name: "Mortgage" }))!.balance).toBe(111111);
  });

  it("reopens a derived-closed liability that resumes; a manually-closed account stays closed", async () => {
    // PR #159 finding 3. V1: Auto ends mid-2023 (derived-closed); Home reaches
    // the edge. V2: Auto gains 2024 snapshots and reaches the new edge again.
    const v1: ExtractResult["workbooks"] = [{
      file: "2023.xlsx", transactions: [], estimateTargets: [],
      liabilitySnapshots: [
        liabSnap("2023.xlsx!DebtsEquity!B7", "Auto", "2023-06-30", 5000),
        liabSnap("2023.xlsx!DebtsEquity!C12", "Home", "2023-12-31", 250000),
      ],
    }];
    const v2: ExtractResult["workbooks"] = [
      v1[0],
      {
        file: "2024.xlsx", transactions: [], estimateTargets: [],
        liabilitySnapshots: [
          liabSnap("2024.xlsx!DebtsEquity!B6", "Auto", "2024-06-30", 1000),
          liabSnap("2024.xlsx!DebtsEquity!C6", "Home", "2024-06-30", 240000),
        ],
      },
    ];

    await apply({ workbooks: v1 });
    expect((await coll("accounts").findOne({ name: "Auto" }))!.closedAt).toBe("2023-06-30");
    // The user manually closes Home on an unrelated date between applies.
    await coll("accounts").updateOne({ name: "Home" }, { $set: { closedAt: "2024-01-15" } });

    await apply({ workbooks: v2 });
    // Auto's closedAt was the derived value (== its previous latest imported
    // snapshot date) and Auto now reaches the edge → $unset fired, reopened.
    const auto = await coll("accounts").findOne({ name: "Auto" });
    expect(auto!.closedAt).toBeUndefined();
    expect(auto!.balance).toBe(1000); // and the balance advanced with it
    // Home's closedAt is user-set (≠ its previous imported snapshot date) → kept.
    expect((await coll("accounts").findOne({ name: "Home" }))!.closedAt).toBe("2024-01-15");
  });

  it("syncs snapshots idempotently and sweeps orphans per file, respecting the unique index", async () => {
    // Create the same unique index the app builds, so a re-apply that tried to
    // insert a duplicate (household, account, date) would actually throw.
    await coll("snapshots").createIndex(
      { householdId: 1, accountId: 1, date: 1 },
      { unique: true },
    );
    await apply();
    const before = await coll("snapshots").countDocuments({ householdId: HH });
    expect(before).toBe(2);

    // Re-apply: pure updates, no unique-index violation on (household, account, date).
    const report = await apply();
    const snapSync = report.syncs.find((s) => s.collection === "snapshots" && s.scope === "2023.xlsx")!;
    expect(snapSync.inserted).toBe(0);
    expect(snapSync.updated).toBe(2);
    expect(await coll("snapshots").countDocuments({ householdId: HH })).toBe(2);

    // Drop a snapshot from the manifest → orphan swept for that file.
    const trimmed = [{
      ...result.workbooks[0],
      liabilitySnapshots: result.workbooks[0].liabilitySnapshots.slice(0, -1),
    }];
    const report2 = await apply({ workbooks: trimmed });
    const swept = report2.syncs.find((s) => s.collection === "snapshots" && s.scope === "2023.xlsx")!;
    expect(swept.deletedOrphans).toBe(1);
    expect(await coll("snapshots").countDocuments({ householdId: HH })).toBe(1);
  });

  it("dry-run reports account/snapshot counts but writes nothing", async () => {
    const report = await apply({ dryRun: true });
    expect(report.syncs.find((s) => s.collection === "accounts")!.inserted).toBe(1);
    expect(report.syncs.find((s) => s.collection === "snapshots")!.inserted).toBe(2);
    expect(await coll("accounts").countDocuments()).toBe(0);
    expect(await coll("snapshots").countDocuments()).toBe(0);
  });
});

describe("resolveHouseholdId", () => {
  it("returns the single household id", async () => {
    expect(await resolveHouseholdId(mongo.db)).toBe(HH);
  });
  it("throws when there is no household", async () => {
    await coll("households").deleteMany({});
    await expect(resolveHouseholdId(mongo.db)).rejects.toThrow(/No household/);
  });
  it("throws when there is more than one", async () => {
    await coll("households").insertOne({ _id: "hh2", createdAt: NOW });
    await expect(resolveHouseholdId(mongo.db)).rejects.toThrow(/exactly one/);
  });
});

describe("runApply — CLI over the memory server", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("reads manifests from disk and applies them", async () => {
    const dir = mkdtempSync(join(tmpdir(), "apply-"));
    const manifestDir = join(dir, "import", "manifest");
    mkdirSync(manifestDir, { recursive: true });
    writeFileSync(join(manifestDir, "categories.json"), JSON.stringify(result.categories));
    writeFileSync(join(manifestDir, "2023.json"), JSON.stringify(result.workbooks[0]));

    vi.stubEnv("MONGODB_URI", mongo.uri);
    const code = await runApply([dir, "--db", "budget-test"]);
    expect(code).toBe(0);
    expect(await coll("transactions").countDocuments({ householdId: HH })).toBe(7);
  });

  it("returns usage code 2 with no archive dir", async () => {
    vi.spyOn(process.stderr, "write").mockReturnValue(true);
    expect(await runApply([])).toBe(2);
  });
});

describe("readManifests", () => {
  it("throws a helpful error when the manifest is missing", () => {
    const empty = mkdtempSync(join(tmpdir(), "empty-"));
    expect(() => readManifests(empty)).toThrow(/run extract first/);
  });
});
