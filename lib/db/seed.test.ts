import { describe, expect, it } from "vitest";

import {
  autoSeedDisabledId,
  buildCategoryDoc,
  buildTargetDoc,
  buildTransactionDoc,
  resolveSeedAction,
  seedDocId,
} from "./seed";

describe("resolveSeedAction", () => {
  it("seeds a fresh, never-touched database", () => {
    expect(
      resolveSeedAction({ autoSeedDisabled: false, hasCategories: false }),
    ).toBe("seed");
  });

  it("backfills a populated database rather than re-seeding it", () => {
    expect(
      resolveSeedAction({ autoSeedDisabled: false, hasCategories: true }),
    ).toBe("backfill");
  });

  it("skips seeding once the DB has been explicitly cleared, even when empty (danger-zone reset stays empty)", () => {
    // The marker set by resetAllData is what keeps a deliberately-emptied
    // budget from silently refilling on the next cold start.
    expect(
      resolveSeedAction({ autoSeedDisabled: true, hasCategories: false }),
    ).toBe("skip");
  });

  it("never re-seeds when the marker is present, regardless of contents", () => {
    expect(
      resolveSeedAction({ autoSeedDisabled: true, hasCategories: true }),
    ).toBe("skip");
  });
});

// Regression guards for the #120 review: seed docs use stable, shared ids, so
// they must be namespaced per household to stay unique across the tenancy
// boundary. Without this, a second household (or a re-bootstrap after a chunk-6
// delete-household) dup-keys on `_id` and fails to seed.
describe("seedDocId", () => {
  it("produces a colon-free 32-char hex id (matches prod's hashImportRef shape)", () => {
    // A `:` in a category `_id` breaks `/categories/[id]` on client-side
    // navigation (404s the detail page). This guards the colon-free scheme so
    // the bug can't regress via the seed.
    const id = seedDocId("h1", "groceries");
    expect(id).toMatch(/^[0-9a-f]{32}$/);
    expect(id).not.toContain(":");
  });

  it("keeps two households' copies of the same seed id distinct", () => {
    expect(seedDocId("h1", "groceries")).not.toBe(seedDocId("h2", "groceries"));
  });

  it("is stable for the same household + id (so re-seeding never duplicates)", () => {
    expect(seedDocId("h1", "t1")).toBe(seedDocId("h1", "t1"));
  });

  it("keeps distinct base ids distinct within a household", () => {
    expect(seedDocId("h1", "groceries")).not.toBe(seedDocId("h1", "dining"));
  });
});

describe("autoSeedDisabledId", () => {
  it("derives a per-household marker id", () => {
    expect(autoSeedDisabledId("h1")).toBe("autoSeedDisabled:h1");
  });

  it("gives different households different marker ids (no reset dup-key)", () => {
    expect(autoSeedDisabledId("h1")).not.toBe(autoSeedDisabledId("h2"));
  });
});

describe("seed builders stamp provenance (#163)", () => {
  // The `source: "seed"` marker lets a future recognizer identify demo data by
  // provenance instead of content-matching seed slugs (the fragile bridge PR
  // #169 removed). Locked in here so a builder that forgets to stamp it fails.
  const now = new Date("2026-01-01T00:00:00Z");
  const HH = "hh1";

  it("stamps source: 'seed' on category docs (namespaced id)", () => {
    const doc = buildCategoryDoc(
      { _id: "groceries", name: "Groceries", kind: "expense", activeFrom: "2026-01" },
      HH,
      now,
    );
    expect(doc.source).toBe("seed");
    expect(doc._id).toBe(seedDocId(HH, "groceries"));
  });

  it("stamps source: 'seed' on target docs", () => {
    const doc = buildTargetDoc(
      {
        _id: "groceries",
        name: "Groceries",
        kind: "expense",
        activeFrom: "2026-01",
        initialMonthly: 800,
      },
      HH,
      now,
    );
    expect(doc?.source).toBe("seed");
  });

  it("stamps source: 'seed' on transaction docs (namespaced refs)", () => {
    const doc = buildTransactionDoc(
      { _id: "t1", categoryId: "groceries", amount: 10, date: "2026-01-05" },
      HH,
      now,
    );
    expect(doc.source).toBe("seed");
    expect(doc._id).toBe(seedDocId(HH, "t1"));
    expect(doc.categoryId).toBe(seedDocId(HH, "groceries"));
  });
});
