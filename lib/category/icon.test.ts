import { describe, expect, it } from "vitest";

import {
  CATEGORY_ICONS,
  DEFAULT_CATEGORY_ICON,
  resolveCategoryIcon,
} from "@/lib/category/icon";

// The emoji every seed category ships with (lib/db/seed.ts). Each must resolve
// to a real, non-default icon so a freshly-seeded app never renders a blank or
// a fallback glyph on a known category.
const SEED_EMOJI = [
  "🛒", // Groceries
  "🍔", // Dining out
  "⛽", // Gas
  "💡", // Utilities
  "🏠", // Rent
  "🎬", // Entertainment
  "🛍️", // Shopping
  "✈️", // Travel
  "🏦", // HYSA
  "📈", // Brokerage
  "🏖️", // Vacation fund
  "💼", // Salary
  "📊", // RSU vests
];

describe("resolveCategoryIcon", () => {
  it("resolves every seed emoji to a specific (non-default) icon", () => {
    for (const emoji of SEED_EMOJI) {
      const Icon = resolveCategoryIcon({ emoji });
      expect(Icon, `no icon for seed emoji ${emoji}`).toBeTruthy();
      expect(Icon, `seed emoji ${emoji} fell back to the default icon`).not.toBe(
        DEFAULT_CATEGORY_ICON,
      );
    }
  });

  it("round-trips each registry entry's emoji back to its own icon", () => {
    for (const entry of CATEGORY_ICONS) {
      expect(
        resolveCategoryIcon({ emoji: entry.emoji }),
        `registry emoji ${entry.emoji} (${entry.key}) did not resolve to its own icon`,
      ).toBe(entry.Icon);
    }
  });

  it("falls back to the default icon for an unknown emoji", () => {
    expect(resolveCategoryIcon({ emoji: "🦄" })).toBe(DEFAULT_CATEGORY_ICON);
    expect(resolveCategoryIcon({ emoji: "" })).toBe(DEFAULT_CATEGORY_ICON);
  });
});

describe("CATEGORY_ICONS registry", () => {
  it("has unique keys and unique representative emoji", () => {
    const keys = CATEGORY_ICONS.map((e) => e.key);
    const emoji = CATEGORY_ICONS.map((e) => e.emoji);
    expect(new Set(keys).size).toBe(keys.length);
    expect(new Set(emoji).size).toBe(emoji.length);
  });

  it("gives every entry a label and an icon component", () => {
    for (const entry of CATEGORY_ICONS) {
      expect(entry.label.length).toBeGreaterThan(0);
      expect(entry.Icon).toBeTruthy();
    }
  });
});
