import { describe, expect, it } from "vitest";

import {
  DEFAULT_CATEGORY_ICON,
  iconByName,
  staticIconFor,
} from "@/lib/category/icon";
import {
  ALL_ICONS,
  catalogIconByName,
  searchIcons,
} from "@/lib/category/iconCatalog";

// The emoji every seed category ships with (lib/db/seed.ts). Each must resolve
// to a real, non-default curated icon so a freshly-seeded app renders instantly
// and never blank.
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

describe("staticIconFor (light render path)", () => {
  it("prefers the stored icon name over emoji", () => {
    // Bitcoin is curated, so it renders statically.
    expect(staticIconFor({ icon: "Bitcoin", emoji: "🛒" })).toBe(
      iconByName("Bitcoin"),
    );
  });

  it("falls back to the legacy emoji when there's no icon name", () => {
    expect(staticIconFor({ emoji: "🛒" })).toBe(iconByName("ShoppingCart"));
  });

  it("resolves every seed emoji to a specific curated icon", () => {
    for (const emoji of SEED_EMOJI) {
      const Icon = staticIconFor({ emoji });
      expect(Icon, `seed emoji ${emoji} did not resolve to a curated icon`).toBeTruthy();
      expect(Icon).not.toBe(DEFAULT_CATEGORY_ICON);
    }
  });

  it("returns undefined for an icon outside the curated set (defers to lazy)", () => {
    // A valid lucide icon that isn't in the curated render set — CategoryIcon
    // renders these via the lazy catalogue, so the static path returns nothing.
    expect(iconByName("Anchor")).toBeUndefined();
    expect(staticIconFor({ icon: "Anchor" })).toBeUndefined();
    // But it IS a real, pickable icon in the full catalogue.
    expect(catalogIconByName("Anchor")).toBeTruthy();
  });

  it("returns undefined when nothing matches at all", () => {
    expect(staticIconFor({})).toBeUndefined();
    expect(staticIconFor({ icon: "Nope", emoji: "🦄" })).toBeUndefined();
  });
});

describe("the full catalogue (lazy path)", () => {
  it("exposes the entire lucide set", () => {
    expect(ALL_ICONS.length).toBeGreaterThan(1000);
  });

  it("finds Bitcoin by name search (the reported miss)", () => {
    expect(searchIcons("bitcoin").some((h) => h.name === "Bitcoin")).toBe(true);
  });

  it("matches humanized multi-word labels", () => {
    expect(
      searchIcons("shopping cart").some((h) => h.name === "ShoppingCart"),
    ).toBe(true);
  });

  it("returns the whole set for an empty query", () => {
    expect(searchIcons("")).toBe(ALL_ICONS);
  });

  it("resolves and rejects names", () => {
    expect(catalogIconByName("Bitcoin")).toBeTruthy();
    expect(catalogIconByName("DefinitelyNotAnIcon")).toBeUndefined();
    expect(catalogIconByName(undefined)).toBeUndefined();
  });
});
