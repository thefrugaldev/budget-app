import { describe, expect, it } from "vitest";

import { blankComments, scanSource } from "./check-design-tokens.mjs";

describe("check-design-tokens scanSource", () => {
  it("flags a raw hex color", () => {
    const v = scanSource(`const bad = "#ff0000";`);
    expect(v).toHaveLength(1);
    expect(v[0].rule).toBe("color-literal");
    expect(v[0].match).toBe("#ff0000");
  });

  it("flags 3-, 6-, and 8-digit hex", () => {
    for (const hex of ["#abc", "#aabbcc", "#aabbccdd"]) {
      expect(scanSource(`color: ${hex};`)[0]?.rule).toBe("color-literal");
    }
  });

  it("flags CSS color functions incl. the modern color() form", () => {
    for (const fn of ["rgb(0,0,0)", "rgba(0,0,0,.5)", "hsl(0 0% 0%)", "oklch(0.5 0 0)", "color(display-p3 1 0 0)"]) {
      expect(scanSource(`background: ${fn};`)[0]?.rule).toBe("color-literal");
    }
  });

  it("flags transition-all", () => {
    const v = scanSource(`className="transition-all duration-200"`);
    expect(v).toHaveLength(1);
    expect(v[0].rule).toBe("transition-all");
  });

  it("passes token-driven code (no literals, scoped transition)", () => {
    const clean = `
      className="bg-primary text-signal-bad-foreground transition-colors"
      style={{ color: "var(--chart-1)" }}
    `;
    expect(scanSource(clean)).toEqual([]);
  });

  it("does not confuse scoped transition utilities with transition-all", () => {
    expect(scanSource(`className="transition-transform transition-colors"`)).toEqual([]);
  });

  it("ignores issue refs and hex named inside comments", () => {
    const src = `
      // Harvest palette (#80) — light #f1e8d7, dark #141109 (#104 refactor)
      /* also #abcdef in a block comment */
      const x = 1;
    `;
    expect(scanSource(src)).toEqual([]);
  });

  it("honors the per-line design-lint-allow opt-out", () => {
    const src = `color: "#f1e8d7", // design-lint-allow: mirrors --background for browser chrome`;
    expect(scanSource(src)).toEqual([]);
  });

  it("still flags a real literal on the line above an allowed one", () => {
    const src = [
      `const sneaky = "#123456";`,
      `const ok = "#f1e8d7"; // design-lint-allow: reason`,
    ].join("\n");
    const v = scanSource(src);
    expect(v).toHaveLength(1);
    expect(v[0].line).toBe(1);
  });

  it("still flags a literal sharing a line with a block comment", () => {
    const v = scanSource(`/* neutralized */ const c = "#ff0000";`);
    expect(v).toHaveLength(1);
    expect(v[0].rule).toBe("color-literal");
    expect(v[0].match).toBe("#ff0000");
  });

  it("does not misread a URL's protocol slashes as a comment", () => {
    // The `//` in https:// is protected by the [^:] guard, so a real literal
    // after the URL on the same line is still scanned.
    const v = scanSource(`const u = "https://x.test"; const c = "#abcdef";`);
    expect(v).toHaveLength(1);
    expect(v[0].match).toBe("#abcdef");
  });

  it("blankComments preserves line count and newlines", () => {
    const src = "a // c\n/* b\nb */\nd";
    const blanked = blankComments(src);
    expect(blanked.split("\n")).toHaveLength(src.split("\n").length);
    expect(blanked).toContain("a ");
    expect(blanked).not.toContain("//");
  });
});
