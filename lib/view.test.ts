import { describe, expect, it } from "vitest";

import {
  DEFAULT_VIEW,
  VIEW_COOKIE,
  parseViewPreference,
  serializeViewCookie,
} from "@/lib/view";

describe("parseViewPreference", () => {
  it("reads a stored preference", () => {
    expect(parseViewPreference("card")).toBe("card");
    expect(parseViewPreference("list")).toBe("list");
  });

  it("defaults to cards when absent", () => {
    expect(parseViewPreference(null)).toBe(DEFAULT_VIEW);
    expect(parseViewPreference(undefined)).toBe(DEFAULT_VIEW);
    expect(parseViewPreference("")).toBe(DEFAULT_VIEW);
  });

  it("defaults to cards for an unrecognised value", () => {
    expect(parseViewPreference("grid")).toBe(DEFAULT_VIEW);
    expect(parseViewPreference("CARD")).toBe(DEFAULT_VIEW);
  });

  it("cards is the default", () => {
    expect(DEFAULT_VIEW).toBe("card");
  });
});

describe("serializeViewCookie", () => {
  it("writes the chosen view under the shared cookie name, rooted for the whole app", () => {
    const cookie = serializeViewCookie("list");
    expect(cookie.startsWith(`${VIEW_COOKIE}=list;`)).toBe(true);
    expect(cookie).toContain("path=/");
    expect(cookie).toContain("samesite=lax");
    expect(cookie).toMatch(/max-age=\d+/);
  });

  it("round-trips through the parser — what it writes is what the server reads", () => {
    for (const view of ["card", "list"] as const) {
      // Mimic the server extracting the cookie value (name=value; ...attrs).
      const value = serializeViewCookie(view).split(";")[0].split("=")[1];
      expect(parseViewPreference(value)).toBe(view);
    }
  });
});
