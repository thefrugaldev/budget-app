import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { startMemoryMongo, type MemoryMongo } from "../../test/memory-mongo";
import { applyManifests } from "./apply";
import { buildExtract } from "./build-manifest";
import { checkParity, expectedTotals, runParity } from "./parity";
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
  return buildExtract({ workbooks: [wb], mapping: fixtureMapping, overrides: fixtureOverrides, income: fixtureIncome });
}

let mongo: MemoryMongo;
let result: ExtractResult;

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
  await applyManifests({
    db: mongo.db, householdId: HH, categories: result.categories,
    workbooks: result.workbooks, dryRun: false, now: NOW,
  });
});

const parity = () => checkParity({ db: mongo.db, householdId: HH, workbooks: result.workbooks });

describe("expectedTotals (pure)", () => {
  it("sums manifest transactions per category-month and tracks provenance", () => {
    const exp = expectedTotals(result.workbooks);
    // Groceries January = 52.10 + 100.00 (the two B2 lines).
    const [key, sum] = [...exp.monthly.entries()].find(([, v]) => Math.round(v * 100) === 15210)!;
    expect(sum).toBeCloseTo(152.1, 2);
    expect(exp.provenanceMonthly.get(key)).toEqual(
      expect.arrayContaining(["2023.xlsx!2023!B2#1", "2023.xlsx!2023!B2#2"]),
    );
  });
});

describe("checkParity — a faithfully applied database", () => {
  it("reports no mismatches", async () => {
    const report = await parity();
    expect(report.mismatches).toEqual([]);
    expect(report.checkedCategoryMonths).toBeGreaterThan(0);
    expect(report.checkedCategoryYears).toBeGreaterThan(0);
  });
});

describe("checkParity — divergences", () => {
  it("flags a tampered amount, naming the cell provenance", async () => {
    const tx = await coll("transactions").findOne({ importRef: "2023.xlsx!2023!B2#1" });
    await coll("transactions").updateOne({ _id: tx!._id }, { $set: { amount: 999 } });

    const report = await parity();
    const monthMiss = report.mismatches.find((m) => m.scope === "month" && m.period === "2023-01");
    expect(monthMiss).toBeDefined();
    expect(monthMiss!.importRefs).toContain("2023.xlsx!2023!B2#1");
    // The same error also surfaces in the YTD (year) aggregation.
    expect(report.mismatches.some((m) => m.scope === "year" && m.period === "2023")).toBe(true);
  });

  it("flags a missing transaction (expected > actual)", async () => {
    const tx = await coll("transactions").findOne({ importRef: "2023.xlsx!2023!B2#2" });
    await coll("transactions").deleteOne({ _id: tx!._id });

    const report = await parity();
    const miss = report.mismatches.find((m) => m.scope === "month" && m.period === "2023-01")!;
    expect(miss.deltaCents).toBe(-10000); // 100.00 short
  });

  it("flags an unexpected DB doc absent from the manifest", async () => {
    const anyCat = await coll("categories").findOne({ importRef: { $exists: true } });
    await coll("transactions").insertOne({
      _id: "extra1", householdId: HH, importRef: "2099.xlsx!2099!Z9#1",
      categoryId: anyCat!._id, amount: 5, date: "2099-01-15", createdAt: NOW,
    });
    const report = await parity();
    const extra = report.mismatches.find((m) => m.period === "2099-01")!;
    expect(extra.expected).toBe(0);
    expect(extra.importRefs).toEqual([]); // DB-only: no manifest provenance
  });
});

describe("runParity — CLI over the memory server", () => {
  afterEach(() => vi.unstubAllEnvs());

  async function archiveDir(): Promise<string> {
    const dir = mkdtempSync(join(tmpdir(), "parity-"));
    const manifestDir = join(dir, "import", "manifest");
    mkdirSync(manifestDir, { recursive: true });
    writeFileSync(join(manifestDir, "categories.json"), JSON.stringify(result.categories));
    writeFileSync(join(manifestDir, "2023.json"), JSON.stringify(result.workbooks[0]));
    return dir;
  }

  it("exits 0 when the database matches the manifest", async () => {
    vi.stubEnv("MONGODB_URI", mongo.uri);
    vi.spyOn(process.stdout, "write").mockReturnValue(true);
    expect(await runParity([await archiveDir(), "--db", "budget-test"])).toBe(0);
  });

  it("exits 1 when a total diverges", async () => {
    await coll("transactions").updateOne({ importRef: "2023.xlsx!2023!B3#1" }, { $set: { amount: 1 } });
    vi.stubEnv("MONGODB_URI", mongo.uri);
    vi.spyOn(process.stdout, "write").mockReturnValue(true);
    expect(await runParity([await archiveDir(), "--db", "budget-test"])).toBe(1);
  });

  it("returns usage code 2 with no archive dir", async () => {
    vi.spyOn(process.stderr, "write").mockReturnValue(true);
    expect(await runParity([])).toBe(2);
  });
});
