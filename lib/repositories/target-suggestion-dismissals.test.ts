import type { Document } from "mongodb";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { ScopedCollection } from "@/lib/db/scoped-collection";

import { startMemoryMongo, type MemoryMongo } from "../../test/memory-mongo";

// Mock only the seam — the session/getDb/Clerk chain — onto in-memory Mongo.
vi.mock("@/lib/db/household-scope", () => ({ scopedCollection: vi.fn() }));

import { scopedCollection } from "@/lib/db/household-scope";

import {
  deleteTargetSuggestionDismissal,
  listTargetSuggestionDismissals,
  upsertTargetSuggestionDismissal,
} from "./target-suggestion-dismissals";

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

describe("targetSuggestionDismissals repository", () => {
  it("lists nothing before anything is dismissed", async () => {
    expect(await listTargetSuggestionDismissals()).toEqual([]);
  });

  it("round-trips a dismissal, stamps the household, and projects dismissedAt to an ISO string", async () => {
    await upsertTargetSuggestionDismissal({
      categoryId: "daycare",
      dismissedMedian: 1300,
      dismissedAgainstTarget: 1000,
    });

    const [d] = await listTargetSuggestionDismissals();
    expect(d).toMatchObject({
      categoryId: "daycare",
      dismissedMedian: 1300,
      dismissedAgainstTarget: 1000,
    });
    // Domain shape carries dismissedAt as an ISO string (Date lives on the doc).
    expect(typeof d.dismissedAt).toBe("string");
    expect(new Date(d.dismissedAt).toISOString()).toBe(d.dismissedAt);

    const raw = await mongo.db
      .collection<{ householdId?: string; dismissedAt?: Date }>("targetSuggestionDismissals")
      .findOne({});
    expect(raw?.householdId).toBe(HH);
    expect(raw?.dismissedAt).toBeInstanceOf(Date);
  });

  it("keeps one row per (household, category) — re-dismissing updates, not inserts", async () => {
    await upsertTargetSuggestionDismissal({
      categoryId: "daycare",
      dismissedMedian: 1300,
      dismissedAgainstTarget: 1000,
    });
    await upsertTargetSuggestionDismissal({
      categoryId: "daycare",
      dismissedMedian: 1600,
      dismissedAgainstTarget: 1000,
    });

    const all = await listTargetSuggestionDismissals();
    expect(all).toHaveLength(1);
    expect(all[0].dismissedMedian).toBe(1600);
  });

  it("keeps dismissals for different categories side by side", async () => {
    await upsertTargetSuggestionDismissal({
      categoryId: "daycare",
      dismissedMedian: 1300,
      dismissedAgainstTarget: 1000,
    });
    await upsertTargetSuggestionDismissal({
      categoryId: "groceries",
      dismissedMedian: 700,
      dismissedAgainstTarget: 900,
    });

    const ids = (await listTargetSuggestionDismissals()).map((d) => d.categoryId).sort();
    expect(ids).toEqual(["daycare", "groceries"]);
  });

  it("deletes a category's dismissal without touching others", async () => {
    await upsertTargetSuggestionDismissal({
      categoryId: "daycare",
      dismissedMedian: 1300,
      dismissedAgainstTarget: 1000,
    });
    await upsertTargetSuggestionDismissal({
      categoryId: "groceries",
      dismissedMedian: 700,
      dismissedAgainstTarget: 900,
    });

    await deleteTargetSuggestionDismissal("daycare");

    const ids = (await listTargetSuggestionDismissals()).map((d) => d.categoryId);
    expect(ids).toEqual(["groceries"]);
  });

  it("deletes idempotently when the category has no dismissal", async () => {
    await expect(deleteTargetSuggestionDismissal("nope")).resolves.toBeUndefined();
    expect(await listTargetSuggestionDismissals()).toEqual([]);
  });

  it("scopes reads to the household — another household's rows are invisible", async () => {
    // Seed a row for a different household directly.
    await mongo.db
      .collection<{ _id: string } & Record<string, unknown>>("targetSuggestionDismissals")
      .insertOne({
        _id: "other",
        householdId: "hh-other",
        categoryId: "daycare",
        dismissedMedian: 999,
        dismissedAgainstTarget: 500,
        dismissedAt: new Date(),
      });

    expect(await listTargetSuggestionDismissals()).toEqual([]);
  });
});
