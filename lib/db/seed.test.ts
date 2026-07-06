import { describe, expect, it } from "vitest";

import { autoSeedDisabledId, resolveSeedAction, seedDocId } from "./seed";

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
  it("namespaces a stable id under its household", () => {
    expect(seedDocId("h1", "groceries")).toBe("h1:groceries");
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
