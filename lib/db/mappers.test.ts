import { describe, expect, it } from "vitest";

import type { CategoryDocument } from "./documents";
import { toCategory } from "./mappers";

describe("toCategory", () => {
  const baseDoc: CategoryDocument = {
    _id: "cat-1",
    name: "Salary",
    emoji: "💼",
    kind: "income",
    activeFrom: "2026-01",
    createdAt: new Date("2026-01-15T00:00:00Z"),
  };

  it("passes through a well-formed document", () => {
    const cat = toCategory({
      ...baseDoc,
      activeUntil: "2026-12",
      incomeFrequency: "recurring",
      payCadence: "bi-weekly",
    });
    expect(cat).toEqual({
      id: "cat-1",
      name: "Salary",
      emoji: "💼",
      kind: "income",
      activeFrom: "2026-01",
      activeUntil: "2026-12",
      incomeFrequency: "recurring",
      payCadence: "bi-weekly",
    });
  });

  it("leaves activeUntil undefined when the document omits it", () => {
    expect(toCategory(baseDoc).activeUntil).toBeUndefined();
  });

  it("normalizes a leaked Mongo null on activeUntil to undefined", () => {
    // Mongo writes `null` (not omitted) when an insert payload includes
    // `activeUntil: undefined`. Without normalisation that null leaks into
    // checks like `activeUntil !== undefined`, fooling them and crashing
    // downstream calls like `monthLabel(activeUntil!).split('-')`.
    const doc = { ...baseDoc, activeUntil: null as unknown as string };
    expect(toCategory(doc).activeUntil).toBeUndefined();
  });

  it("backfills a legacy income document with no frequency to 'recurring' (story 8)", () => {
    // An income doc predating #46 has no `incomeFrequency` stored.
    expect(toCategory(baseDoc).incomeFrequency).toBe("recurring");
  });

  it("leaves a one-time income document's stored frequency intact", () => {
    const doc = { ...baseDoc, incomeFrequency: "one-time" as const };
    expect(toCategory(doc).incomeFrequency).toBe("one-time");
  });

  it("does not assign a frequency to non-income categories", () => {
    const expenseDoc = { ...baseDoc, kind: "expense" as const };
    expect(toCategory(expenseDoc).incomeFrequency).toBeUndefined();
  });

  it("reads payCadence through and leaves it undefined when unset (story 10 fallback)", () => {
    expect(toCategory(baseDoc).payCadence).toBeUndefined();
    const withCadence = { ...baseDoc, payCadence: "bi-weekly" as const };
    expect(toCategory(withCadence).payCadence).toBe("bi-weekly");
  });

  it("normalizes a leaked Mongo null on payCadence to undefined", () => {
    const doc = { ...baseDoc, payCadence: null as unknown as undefined };
    expect(toCategory(doc).payCadence).toBeUndefined();
  });
});
