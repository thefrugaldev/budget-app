import { describe, expect, it } from "vitest";

import {
  assertNonEmptyName,
  assertNonNegativeSnapshotValue,
  assertValidAccountShape,
  assertValidHolding,
  assertValidIsoDate,
} from "./validate";

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

describe("assertValidHolding", () => {
  it("accepts a holding with a ticker, non-negative quantity, and optional override", () => {
    expect(() => assertValidHolding({ ticker: "VOO", quantity: 10 })).not.toThrow();
    expect(() => assertValidHolding({ ticker: "VOO", quantity: 0 })).not.toThrow();
    expect(() => assertValidHolding({ ticker: "VOO", quantity: 10, priceOverride: 12.5 })).not.toThrow();
  });

  it("rejects a blank ticker", () => {
    expect(() => assertValidHolding({ ticker: "  ", quantity: 10 })).toThrow(/must have a ticker/);
  });

  it("rejects a negative or non-finite quantity", () => {
    expect(() => assertValidHolding({ ticker: "VOO", quantity: -1 })).toThrow(/quantity/);
    expect(() => assertValidHolding({ ticker: "VOO", quantity: Number.NaN })).toThrow(/quantity/);
  });

  it("rejects a negative or non-finite price override", () => {
    expect(() => assertValidHolding({ ticker: "VOO", quantity: 1, priceOverride: -5 })).toThrow(
      /price override/,
    );
    expect(() =>
      assertValidHolding({ ticker: "VOO", quantity: 1, priceOverride: Number.POSITIVE_INFINITY }),
    ).toThrow(/price override/);
  });
});

describe("assertNonEmptyName", () => {
  it("accepts a real name", () => {
    expect(() => assertNonEmptyName("Brokerage")).not.toThrow();
  });

  it("rejects empty or whitespace-only names", () => {
    expect(() => assertNonEmptyName("")).toThrow(/must not be empty/);
    expect(() => assertNonEmptyName("   ")).toThrow(/must not be empty/);
  });
});

describe("assertValidIsoDate", () => {
  it("accepts a real ISO calendar date", () => {
    expect(() => assertValidIsoDate("2026-02-28")).not.toThrow();
    expect(() => assertValidIsoDate("2024-02-29")).not.toThrow(); // leap day
  });

  it("rejects the wrong shape", () => {
    expect(() => assertValidIsoDate("2026-2-8")).toThrow(/ISO calendar date/);
    expect(() => assertValidIsoDate("2026/02/28")).toThrow(/ISO calendar date/);
    expect(() => assertValidIsoDate("")).toThrow(/ISO calendar date/);
  });

  it("rejects impossible days a bare regex would let through", () => {
    expect(() => assertValidIsoDate("2026-02-30")).toThrow(/not a real calendar date/);
    expect(() => assertValidIsoDate("2026-13-01")).toThrow(/not a real calendar date/);
    expect(() => assertValidIsoDate("2025-02-29")).toThrow(/not a real calendar date/); // not a leap year
  });
});
