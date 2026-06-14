import { describe, expect, it } from "vitest";
import type { Category, CategoryTarget } from "@/types/budget";
import {
  buildIncomeSourceDisplayLabel,
  classifyIncomeSourceStatus,
  type IncomeSourceStatus,
} from "./income";

const incomeCat = (overrides: Partial<Category> = {}): Category => ({
  id: "salary",
  name: "Salary",
  emoji: "💼",
  kind: "income",
  activeFrom: "2026-01",
  ...overrides,
});

describe("classifyIncomeSourceStatus", () => {
  it("returns 'active' for a source with no targets", () => {
    expect(classifyIncomeSourceStatus(incomeCat(), "2026-06", [])).toBe("active");
  });

  it("returns 'active' when the only target is past-effective (the current baseline)", () => {
    const targets: CategoryTarget[] = [
      { categoryId: "salary", monthly: 7500, effectiveFrom: "2026-01" },
    ];
    expect(classifyIncomeSourceStatus(incomeCat(), "2026-06", targets)).toBe("active");
  });

  it("treats a target effective at the current month as the current baseline, not scheduled", () => {
    const targets: CategoryTarget[] = [
      { categoryId: "salary", monthly: 8000, effectiveFrom: "2026-06" },
    ];
    expect(classifyIncomeSourceStatus(incomeCat(), "2026-06", targets)).toBe("active");
  });

  it("returns 'scheduled-change' when a target is effective next month", () => {
    const targets: CategoryTarget[] = [
      { categoryId: "salary", monthly: 7500, effectiveFrom: "2026-01" },
      { categoryId: "salary", monthly: 8500, effectiveFrom: "2026-07" },
    ];
    expect(classifyIncomeSourceStatus(incomeCat(), "2026-06", targets)).toBe(
      "scheduled-change",
    );
  });

  it("returns 'ended' when activeUntil equals the current month", () => {
    const ended = incomeCat({ activeUntil: "2026-06" });
    expect(classifyIncomeSourceStatus(ended, "2026-06", [])).toBe("ended");
  });

  it("returns 'ended' when activeUntil is in the past", () => {
    const ended = incomeCat({ activeUntil: "2026-03" });
    expect(classifyIncomeSourceStatus(ended, "2026-06", [])).toBe("ended");
  });

  it("returns 'active' when activeUntil is still in the future", () => {
    const futureBound = incomeCat({ activeUntil: "2026-12" });
    expect(classifyIncomeSourceStatus(futureBound, "2026-06", [])).toBe("active");
  });

  it("prefers 'ended' over 'scheduled-change' when both conditions are met", () => {
    const ended = incomeCat({ activeUntil: "2026-06" });
    const targets: CategoryTarget[] = [
      { categoryId: "salary", monthly: 9000, effectiveFrom: "2026-08" },
    ];
    expect(classifyIncomeSourceStatus(ended, "2026-06", targets)).toBe("ended");
  });

  it("ignores target rows that belong to other categories", () => {
    const targets: CategoryTarget[] = [
      { categoryId: "bonus", monthly: 5000, effectiveFrom: "2026-08" },
    ];
    expect(classifyIncomeSourceStatus(incomeCat(), "2026-06", targets)).toBe("active");
  });
});

describe("buildIncomeSourceDisplayLabel", () => {
  it("returns the bare name when no other source shares it", () => {
    const salary = incomeCat({ id: "salary", name: "Salary" });
    const bonus = incomeCat({ id: "bonus", name: "Bonus" });
    expect(buildIncomeSourceDisplayLabel(salary, [salary, bonus], "active")).toBe(
      "Salary",
    );
  });

  it("suffixes both rows when two active sources share a name", () => {
    const a = incomeCat({ id: "a", name: "Bonus", activeFrom: "2026-01" });
    const b = incomeCat({ id: "b", name: "Bonus", activeFrom: "2026-05" });
    expect(buildIncomeSourceDisplayLabel(a, [a, b], "active")).toBe(
      "Bonus · since January 2026",
    );
    expect(buildIncomeSourceDisplayLabel(b, [a, b], "active")).toBe(
      "Bonus · since May 2026",
    );
  });

  it("suffixes an active row with 'scheduled change' when colliding with an ended row", () => {
    const scheduled = incomeCat({ id: "a", name: "Bonus" });
    const ended = incomeCat({
      id: "b",
      name: "Bonus",
      activeFrom: "2025-01",
      activeUntil: "2026-06",
    });
    expect(
      buildIncomeSourceDisplayLabel(scheduled, [scheduled, ended], "scheduled-change"),
    ).toBe("Bonus · scheduled change");
    expect(buildIncomeSourceDisplayLabel(ended, [scheduled, ended], "ended")).toBe(
      "Bonus · ended June 2026",
    );
  });

  it("detects case-insensitive collisions", () => {
    const upper = incomeCat({ id: "a", name: "Bonus", activeFrom: "2026-01" });
    const lower = incomeCat({ id: "b", name: "bonus", activeFrom: "2026-03" });
    expect(buildIncomeSourceDisplayLabel(upper, [upper, lower], "active")).toBe(
      "Bonus · since January 2026",
    );
    expect(buildIncomeSourceDisplayLabel(lower, [upper, lower], "active")).toBe(
      "bonus · since March 2026",
    );
  });

  it("treats leading/trailing whitespace as part of the same normalized name", () => {
    const trimmed = incomeCat({ id: "a", name: "Bonus", activeFrom: "2026-01" });
    const padded = incomeCat({ id: "b", name: "  Bonus  ", activeFrom: "2026-03" });
    expect(buildIncomeSourceDisplayLabel(trimmed, [trimmed, padded], "active")).toBe(
      "Bonus · since January 2026",
    );
  });

  it("handles three-way collisions by suffixing every colliding row", () => {
    const active = incomeCat({ id: "a", name: "Bonus", activeFrom: "2026-01" });
    const scheduled = incomeCat({ id: "b", name: "Bonus", activeFrom: "2026-04" });
    const ended = incomeCat({
      id: "c",
      name: "Bonus",
      activeFrom: "2025-01",
      activeUntil: "2026-03",
    });
    const all = [active, scheduled, ended];
    expect(buildIncomeSourceDisplayLabel(active, all, "active")).toBe(
      "Bonus · since January 2026",
    );
    expect(buildIncomeSourceDisplayLabel(scheduled, all, "scheduled-change")).toBe(
      "Bonus · scheduled change",
    );
    expect(buildIncomeSourceDisplayLabel(ended, all, "ended")).toBe(
      "Bonus · ended March 2026",
    );
  });

  it("ignores the source itself when checking for collisions", () => {
    const only = incomeCat({ id: "a", name: "Bonus" });
    expect(buildIncomeSourceDisplayLabel(only, [only], "active")).toBe("Bonus");
  });

  it("falls back to a bare 'ended' suffix when activeUntil is missing (defensive)", () => {
    // Shouldn't happen in real data (an "ended" status implies activeUntil),
    // but the label builder shouldn't render `ended undefined` if it does.
    const a = incomeCat({ id: "a", name: "Bonus" });
    const b = incomeCat({ id: "b", name: "Bonus" });
    const status: IncomeSourceStatus = "ended";
    expect(buildIncomeSourceDisplayLabel(a, [a, b], status)).toBe("Bonus · ended");
  });
});
