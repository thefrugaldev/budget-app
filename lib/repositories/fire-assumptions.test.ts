import type { Document } from "mongodb";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { ScopedCollection } from "@/lib/db/scoped-collection";

import { startMemoryMongo, type MemoryMongo } from "../../test/memory-mongo";

// Mock only the seam — the session/getDb/Clerk chain — onto in-memory Mongo.
vi.mock("@/lib/db/household-scope", () => ({ scopedCollection: vi.fn() }));

import { scopedCollection } from "@/lib/db/household-scope";

import {
  clearFireAssumptions,
  getFireAssumptionOverrides,
  saveFireAssumptionOverrides,
} from "./fire-assumptions";

const HH = "hh-test";
let mongo: MemoryMongo;

beforeAll(async () => {
  mongo = await startMemoryMongo();
  vi.mocked(scopedCollection).mockImplementation(
    async <T extends { householdId?: string } & Document>(name: string) =>
      new ScopedCollection<T>(mongo.db.collection<T>(name), HH),
  );
}, 60_000);

afterAll(async () => {
  await mongo?.stop();
});

beforeEach(() => mongo.reset());

describe("fire-assumptions repository", () => {
  it("returns null before anything is saved", async () => {
    expect(await getFireAssumptionOverrides()).toBeNull();
  });

  it("round-trips a partial override set and stamps the household", async () => {
    await saveFireAssumptionOverrides({ monthlyRetirementSpend: 5000, birthYear: 1990 });

    expect(await getFireAssumptionOverrides()).toEqual({
      monthlyRetirementSpend: 5000,
      birthYear: 1990,
    });

    const raw = await mongo.db
      .collection<{ _id: string } & Record<string, unknown>>("fireAssumptions")
      .findOne({});
    expect(raw?.householdId).toBe(HH);
    expect(raw?.updatedAt).toBeInstanceOf(Date);
  });

  it("keeps exactly one document per household (upsert, not insert)", async () => {
    await saveFireAssumptionOverrides({ nominalReturn: 6 });
    await saveFireAssumptionOverrides({ nominalReturn: 8 });

    const count = await mongo.db.collection("fireAssumptions").countDocuments({});
    expect(count).toBe(1);
    expect(await getFireAssumptionOverrides()).toEqual({ nominalReturn: 8 });
  });

  it("unsets knobs omitted from a later save (omitted = tracks default, not unchanged)", async () => {
    await saveFireAssumptionOverrides({ monthlyRetirementSpend: 5000, inflation: 2.5 });
    await saveFireAssumptionOverrides({ inflation: 3.5 });

    expect(await getFireAssumptionOverrides()).toEqual({ inflation: 3.5 });
  });

  it("preserves a zero override (a deliberate value, not absence)", async () => {
    await saveFireAssumptionOverrides({ monthlyContribution: 0 });
    expect(await getFireAssumptionOverrides()).toEqual({ monthlyContribution: 0 });
  });

  it("clears the whole set back to null (reset-to-defaults)", async () => {
    await saveFireAssumptionOverrides({ birthYear: 1985, safeWithdrawalRate: 3.5 });
    await clearFireAssumptions();

    expect(await getFireAssumptionOverrides()).toBeNull();
    expect(await mongo.db.collection("fireAssumptions").countDocuments({})).toBe(0);
  });

  it("clears idempotently when nothing is stored", async () => {
    await expect(clearFireAssumptions()).resolves.toBeUndefined();
    expect(await getFireAssumptionOverrides()).toBeNull();
  });
});
