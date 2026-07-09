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
    expect(report.skippedLiabilitySnapshots).toBe(2);
  });

  it("spares hand-entered (non-seed) data when wiping the seed", async () => {
    // Seed doc (namespaced key) + a hand-entered transaction (UUID key, no ref).
    await coll("categories").insertOne({ _id: `${HH}:groceries`, householdId: HH, name: "Groceries", kind: "expense", activeFrom: "2026-01", createdAt: NOW });
    await coll("transactions").insertOne({ _id: "8f0e-uuid-manual", householdId: HH, categoryId: `${HH}:groceries`, amount: 12, date: "2026-07-01", createdAt: NOW });

    const report = await apply({ firstApply: true });
    expect(report.seedWiped).toBe(1); // only the namespaced seed category
    // The hand-entered transaction survives.
    expect(await coll("transactions").countDocuments({ _id: "8f0e-uuid-manual" })).toBe(1);
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
