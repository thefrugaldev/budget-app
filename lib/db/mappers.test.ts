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
    const cat = toCategory({ ...baseDoc, activeUntil: "2026-12" });
    expect(cat).toEqual({
      id: "cat-1",
      name: "Salary",
      emoji: "💼",
      kind: "income",
      activeFrom: "2026-01",
      activeUntil: "2026-12",
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
});
