import { describe, expect, it } from "vitest";

import { resolveSeedAction } from "./seed";

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
