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

function apply(opts: { dryRun?: boolean; firstApply?: boolean; workbooks?: ExtractResult["workbooks"]; now?: Date } = {}) {
  return applyManifests({
    db: mongo.db,
    householdId: HH,
    categories: result.categories,
    workbooks: opts.workbooks ?? result.workbooks,
    dryRun: opts.dryRun ?? false,
    firstApply: opts.firstApply ?? false,
    now: opts.now ?? NOW,
  });
}

describe("applyManifests — first apply", () => {
  it("wipes seed data, disables auto-seed, and syncs imported docs with provenance", async () => {
    // A demo/seed category with no importRef, plus a stray manual transaction.
    await coll("categories").insertOne({ _id: `${HH}:groceries`, householdId: HH, name: "Groceries", kind: "expense", activeFrom: "2026-01", createdAt: NOW });
    await coll("transactions").insertOne({ _id: `${HH}:t1`, householdId: HH, categoryId: `${HH}:groceries`, amount: 10, date: "2026-01-01", createdAt: NOW });

    const report = await apply({ firstApply: true });
    expect(report.seedWiped).toBe(2);

    // Seed docs gone; imported docs present, household-stamped, ref-bearing.
    expect(await coll("categories").countDocuments({ importRef: { $exists: false } })).toBe(0);
    const groceries = await coll("categories").findOne({ name: "Groceries" });
    expect(groceries).toMatchObject({ householdId: HH });
    expect(typeof groceries!.importRef).toBe("string");

    // Auto-seed marker written.
    expect(await coll("meta").countDocuments({ _id: `autoSeedDisabled:${HH}` })).toBe(1);

    // Insert counts: 4 categories, 1 income baseline, 7 transactions, 2 estimate targets.
    const byScope = (collection: string, scope: string | null) =>
      report.syncs.find((s) => s.collection === collection && s.scope === scope)!;
    expect(byScope("categories", null).inserted).toBe(4);
    expect(byScope("categoryTargets", null).inserted).toBe(1);
    expect(byScope("transactions", "2023.xlsx").inserted).toBe(7);
    expect(byScope("categoryTargets", "2023.xlsx").inserted).toBe(2);
    // One derived liability account (Mortgage) + its two monthly snapshots.
    expect(byScope("accounts", null).inserted).toBe(1);
    expect(byScope("snapshots", "2023.xlsx").inserted).toBe(2);
  });

  it("spares hand-entered (non-seed) data when wiping the seed", async () => {
    // Seed docs (namespaced keys) + a hand-entered category and transaction
    // (UUID keys, UUID category ref — the shape the app's create paths write).
    await coll("categories").insertOne({ _id: `${HH}:groceries`, householdId: HH, name: "Groceries", kind: "expense", activeFrom: "2026-01", createdAt: NOW });
    await coll("categories").insertOne({ _id: "5e0a-uuid-cat", householdId: HH, name: "My Category", kind: "expense", activeFrom: "2026-06", createdAt: NOW });
    await coll("transactions").insertOne({ _id: "8f0e-uuid-manual", householdId: HH, categoryId: "5e0a-uuid-cat", amount: 12, date: "2026-07-01", createdAt: NOW });

    const report = await apply({ firstApply: true });
    expect(report.seedWiped).toBe(1); // only the namespaced seed category
    // The hand-entered category and transaction survive.
    expect(await coll("categories").countDocuments({ _id: "5e0a-uuid-cat" })).toBe(1);
    expect(await coll("transactions").countDocuments({ _id: "8f0e-uuid-manual" })).toBe(1);
  });

  it("wipes a LEGACY-seeded household (bare ids, bare categoryId refs)", async () => {
    // A pre-#111 database: seed docs carry bare slugs, not namespaced keys —
    // categories like "groceries", transactions "t1"…, and target docs keyed
    // `<categoryId>:<activeFrom>`. The namespaced-prefix regex alone matches
    // none of these (the rehearsal finding: "0 seed doc(s) wiped").
    await coll("categories").insertMany([
      { _id: "groceries", householdId: HH, name: "Groceries", kind: "expense", activeFrom: "2026-01", createdAt: NOW },
      { _id: "salary", householdId: HH, name: "Salary", kind: "income", activeFrom: "2026-01", createdAt: NOW },
    ]);
    await coll("categoryTargets").insertOne({ _id: "groceries:2026-01", householdId: HH, categoryId: "groceries", monthly: 800, effectiveFrom: "2026-01", createdAt: NOW });
    await coll("transactions").insertMany([
      { _id: "t1", householdId: HH, categoryId: "groceries", amount: 87.42, date: "2026-06-04", createdAt: NOW },
      { _id: "t54", householdId: HH, categoryId: "rsu", amount: 12500, date: "2026-03-15", createdAt: NOW },
    ]);
    // Hand-entered data: UUID id AND UUID category ref — must survive the wipe.
    await coll("categories").insertOne({ _id: "5e0a-uuid-cat", householdId: HH, name: "My Category", kind: "expense", activeFrom: "2026-06", createdAt: NOW });
    await coll("transactions").insertOne({ _id: "8f0e-uuid-tx", householdId: HH, categoryId: "5e0a-uuid-cat", amount: 12, date: "2026-07-01", createdAt: NOW });

    const report = await apply({ firstApply: true });
    expect(report.seedWiped).toBe(5); // 2 categories + 1 target + 2 transactions

    // Every legacy seed doc is gone…
    expect(await coll("categories").countDocuments({ _id: { $in: ["groceries", "salary"] } })).toBe(0);
    expect(await coll("categoryTargets").countDocuments({ _id: "groceries:2026-01" })).toBe(0);
    expect(await coll("transactions").countDocuments({ _id: { $in: ["t1", "t54"] } })).toBe(0);
    // …while the hand-entered docs and the household survive.
    expect(await coll("categories").countDocuments({ _id: "5e0a-uuid-cat" })).toBe(1);
    expect(await coll("transactions").countDocuments({ _id: "8f0e-uuid-tx" })).toBe(1);
    expect(await coll("households").countDocuments({ _id: HH })).toBe(1);
  });

  it("dry-run projects the legacy wipe count without deleting", async () => {
    await coll("categories").insertOne({ _id: "dining", householdId: HH, name: "Dining out", kind: "expense", activeFrom: "2026-01", createdAt: NOW });
    await coll("transactions").insertOne({ _id: "t2", householdId: HH, categoryId: "dining", amount: 24.5, date: "2026-06-04", createdAt: NOW });

    const report = await apply({ dryRun: true, firstApply: true });
    expect(report.seedWiped).toBe(2); // projected: the category + its transaction
    expect(await coll("categories").countDocuments({ _id: "dining" })).toBe(1); // not wiped
    expect(await coll("transactions").countDocuments({ _id: "t2" })).toBe(1);
  });

  it("refuses --first-apply once imported data exists", async () => {
    await apply({ firstApply: true });
    await expect(apply({ firstApply: true })).rejects.toThrow(/refused/);
  });

  it("dry-run + first-apply writes nothing (no wipe, no marker, no sync)", async () => {
    await coll("categories").insertOne({ _id: `${HH}:groceries`, householdId: HH, name: "Groceries", kind: "expense", activeFrom: "2026-01", createdAt: NOW });
    const report = await apply({ dryRun: true, firstApply: true });
    expect(report.seedWiped).toBe(1); // projected count
    expect(await coll("categories").countDocuments({ _id: `${HH}:groceries` })).toBe(1); // not wiped
    expect(await coll("meta").countDocuments({ _id: `autoSeedDisabled:${HH}` })).toBe(0); // no marker
    expect(await coll("transactions").countDocuments()).toBe(0); // nothing synced
  });
});

describe("applyManifests — idempotent re-apply", () => {
  it("re-applies as pure updates and preserves createdAt", async () => {
    await apply({ firstApply: true, now: NOW });
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
    await apply({ firstApply: true });
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
});

describe("applyManifests — liability accounts & snapshots", () => {
  it("derives one account per canonical liability with class/importRef/balance-from-latest", async () => {
    await apply({ firstApply: true });
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
    await apply({ firstApply: true, workbooks });

    const auto = await coll("accounts").findOne({ name: "Auto" });
    const home = await coll("accounts").findOne({ name: "Home" });
    expect(auto!.closedAt).toBe("2023-12-31"); // last snapshot before the edge
    expect(home!.closedAt).toBeUndefined(); // reaches the archive edge → open
    expect(home!.balance).toBe(240000); // latest snapshot balance
  });

  it("preserves a user-edited balance and derived closedAt across re-apply ($setOnInsert)", async () => {
    await apply({ firstApply: true });
    const mortgage = await coll("accounts").findOne({ name: "Mortgage" });

    // Simulate a post-cutover check-in editing the live balance.
    await coll("accounts").updateOne({ _id: mortgage!._id }, { $set: { balance: 111111 } });

    await apply(); // re-apply (no first-apply)
    const after = await coll("accounts").findOne({ _id: mortgage!._id });
    expect(after!.balance).toBe(111111); // NOT clobbered back to the manifest balance
    expect(after!.name).toBe("Mortgage"); // identity fields still refreshed
  });

  it("syncs snapshots idempotently and sweeps orphans per file, respecting the unique index", async () => {
    // Create the same unique index the app builds, so a re-apply that tried to
    // insert a duplicate (household, account, date) would actually throw.
    await coll("snapshots").createIndex(
      { householdId: 1, accountId: 1, date: 1 },
      { unique: true },
    );
    await apply({ firstApply: true });
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
