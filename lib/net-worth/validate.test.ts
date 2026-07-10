import { describe, expect, it } from "vitest";

import { assertNonNegativeSnapshotValue, assertValidAccountShape } from "./validate";

describe("assertValidAccountShape", () => {
  it("accepts an asset with a kind", () => {
    expect(() => assertValidAccountShape({ class: "asset", kind: "cash" })).not.toThrow();
    expect(() => assertValidAccountShape({ class: "asset", kind: "investment" })).not.toThrow();
    expect(() => assertValidAccountShape({ class: "asset", kind: "property" })).not.toThrow();
  });

  it("accepts a liability with no kind", () => {
    expect(() => assertValidAccountShape({ class: "liability" })).not.toThrow();
  });

  it("rejects an asset with no kind (would default to a cash-like balance)", () => {
    expect(() => assertValidAccountShape({ class: "asset" })).toThrow(/asset account must have a kind/);
  });

  it("rejects a liability that carries a kind", () => {
    expect(() => assertValidAccountShape({ class: "liability", kind: "cash" })).toThrow(
      /liability account must not have a kind/,
    );
  });
});

describe("assertNonNegativeSnapshotValue", () => {
  it("accepts zero and positive magnitudes", () => {
    expect(() => assertNonNegativeSnapshotValue(0)).not.toThrow();
    expect(() => assertNonNegativeSnapshotValue(12_345.67)).not.toThrow();
  });

  it("rejects negative values (they would flip a liability's sign)", () => {
    expect(() => assertNonNegativeSnapshotValue(-1)).toThrow(/non-negative magnitude/);
  });

  it("rejects non-finite values", () => {
    expect(() => assertNonNegativeSnapshotValue(Number.NaN)).toThrow();
    expect(() => assertNonNegativeSnapshotValue(Number.POSITIVE_INFINITY)).toThrow();
  });
});
