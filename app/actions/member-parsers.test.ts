import { describe, expect, it } from "vitest";

import {
  parseInvitableRole,
  parseInviteEmail,
  parseInviteId,
  parseUserId,
} from "./member-parsers";

describe("parseInviteEmail", () => {
  it("normalizes case and surrounding whitespace", () => {
    expect(parseInviteEmail("  Spouse@Example.COM ")).toBe(
      "spouse@example.com",
    );
  });

  it("accepts plus-addressing and subdomains", () => {
    expect(parseInviteEmail("a.b+tag@mail.example.co")).toBe(
      "a.b+tag@mail.example.co",
    );
  });

  it("rejects empty input", () => {
    expect(() => parseInviteEmail("")).toThrow(/required/i);
    expect(() => parseInviteEmail("   ")).toThrow(/required/i);
    expect(() => parseInviteEmail(null)).toThrow(/required/i);
  });

  it("rejects malformed addresses", () => {
    expect(() => parseInviteEmail("nope")).toThrow(/valid email/i);
    expect(() => parseInviteEmail("no@domain")).toThrow(/valid email/i);
    expect(() => parseInviteEmail("@example.com")).toThrow(/valid email/i);
    expect(() => parseInviteEmail("two@@example.com")).toThrow(/valid email/i);
    expect(() => parseInviteEmail("has space@example.com")).toThrow(
      /valid email/i,
    );
  });
});

describe("parseInvitableRole", () => {
  it("accepts editor and viewer", () => {
    expect(parseInvitableRole("editor")).toBe("editor");
    expect(parseInvitableRole("viewer")).toBe("viewer");
  });

  it("rejects owner — never invitable or assignable (ADR 0004)", () => {
    expect(() => parseInvitableRole("owner")).toThrow(/role/i);
  });

  it("rejects unknown or empty roles", () => {
    expect(() => parseInvitableRole("admin")).toThrow(/role/i);
    expect(() => parseInvitableRole("")).toThrow(/role/i);
    expect(() => parseInvitableRole(null)).toThrow(/role/i);
  });
});

describe("parseUserId", () => {
  it("trims and returns a non-empty id", () => {
    expect(parseUserId("  user-123 ")).toBe("user-123");
  });

  it("rejects empty input", () => {
    expect(() => parseUserId("")).toThrow(/required/i);
    expect(() => parseUserId(null)).toThrow(/required/i);
  });
});

describe("parseInviteId", () => {
  it("trims and returns a non-empty id", () => {
    expect(parseInviteId("  invite-9 ")).toBe("invite-9");
  });

  it("rejects empty input", () => {
    expect(() => parseInviteId("")).toThrow(/required/i);
    expect(() => parseInviteId(null)).toThrow(/required/i);
  });
});
