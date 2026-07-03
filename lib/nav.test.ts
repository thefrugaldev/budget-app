import { describe, expect, it } from "vitest";
import { NAV_ITEMS, isActive } from "./nav";

describe("NAV_ITEMS", () => {
  it("is non-empty", () => {
    expect(NAV_ITEMS.length).toBeGreaterThan(0);
  });

  it("hrefs are unique", () => {
    const hrefs = NAV_ITEMS.map((item) => item.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  it("every href starts with /", () => {
    for (const item of NAV_ITEMS) {
      expect(item.href.startsWith("/")).toBe(true);
    }
  });

  it("every label is non-empty and every icon is a component", () => {
    for (const item of NAV_ITEMS) {
      expect(item.label.length).toBeGreaterThan(0);
      // icon is a lucide component (#80 chunk 4), no longer an emoji string.
      expect(item.icon).toBeTruthy();
      expect(["function", "object"]).toContain(typeof item.icon);
    }
  });

  it("the redundant Categories index is no longer a destination (#79)", () => {
    expect(NAV_ITEMS.some((item) => item.href === "/categories")).toBe(false);
  });

  it("FIRE took the freed slot as a marked placeholder (#79)", () => {
    const fire = NAV_ITEMS.find((item) => item.href === "/fire");
    expect(fire?.placeholder).toBe(true);
  });

  // Story 16: the /categories/[id] detail page is not itself a nav destination,
  // so no tab should light up while you're on it (the old /categories item used
  // to claim it via prefix match).
  it("no nav item is active on a category detail path", () => {
    const active = NAV_ITEMS.filter((item) =>
      isActive("/categories/groceries", item.href),
    );
    expect(active).toEqual([]);
  });
});

describe("isActive", () => {
  it("exact match on /", () => {
    expect(isActive("/", "/")).toBe(true);
  });

  it("non-root href does not match /", () => {
    expect(isActive("/", "/categories")).toBe(false);
  });

  it("/ does not match every nested route", () => {
    expect(isActive("/categories/groceries", "/")).toBe(false);
  });

  it("exact match on a non-root href", () => {
    expect(isActive("/categories", "/categories")).toBe(true);
  });

  it("nested path matches its parent href", () => {
    expect(isActive("/categories/groceries", "/categories")).toBe(true);
  });

  it("non-match: different sibling", () => {
    expect(isActive("/income", "/categories")).toBe(false);
  });

  it("non-match: prefix-only without slash boundary", () => {
    // /categories-archived must NOT match /categories
    expect(isActive("/categories-archived", "/categories")).toBe(false);
  });

  it("trailing slash on the pathname is ignored", () => {
    expect(isActive("/categories/", "/categories")).toBe(true);
  });

  it("trailing slash on the href is ignored", () => {
    expect(isActive("/categories", "/categories/")).toBe(true);
  });

  it("query string is ignored", () => {
    expect(isActive("/categories?range=ytd", "/categories")).toBe(true);
  });

  it("hash fragment is ignored", () => {
    expect(isActive("/categories#filters", "/categories")).toBe(true);
  });

  it("query + hash together are ignored", () => {
    expect(isActive("/categories?range=ytd#filters", "/categories")).toBe(true);
  });

  it("query on / pathname still matches / exactly", () => {
    expect(isActive("/?range=last-month", "/")).toBe(true);
  });

  it("nested path with query matches parent href", () => {
    expect(isActive("/categories/groceries?range=ytd", "/categories")).toBe(
      true,
    );
  });
});
