import { describe, expect, it } from "vitest";

import { matchInvite, normalizeEmail } from "@/lib/auth/invite";
import type { Invite } from "@/types/auth";

function invite(over: Partial<Invite> & { id: string }): Invite {
  return {
    householdId: "h1",
    email: "spouse@example.com",
    role: "editor",
    status: "pending",
    ...over,
  };
}

describe("normalizeEmail", () => {
  it("trims surrounding whitespace and lowercases", () => {
    expect(normalizeEmail("  Spouse@Example.COM ")).toBe("spouse@example.com");
  });

  it("is idempotent on an already-normalized email", () => {
    expect(normalizeEmail("a@b.com")).toBe("a@b.com");
  });

  it("does not fold gmail dots or plus-addressing (deliberately conservative)", () => {
    expect(normalizeEmail("a.b+tag@gmail.com")).toBe("a.b+tag@gmail.com");
  });
});

describe("matchInvite", () => {
  it("matches a pending invite case- and space-insensitively", () => {
    const inv = invite({ id: "i1", email: "Spouse@Example.com" });
    expect(matchInvite("  spouse@example.COM ", [inv])).toBe(inv);
  });

  it("returns undefined when no invite matches the email", () => {
    expect(
      matchInvite("stranger@example.com", [invite({ id: "i1" })]),
    ).toBeUndefined();
  });

  it("ignores a consumed (accepted) invite even on an email match", () => {
    const consumed = invite({ id: "i1", status: "accepted" });
    expect(matchInvite("spouse@example.com", [consumed])).toBeUndefined();
  });

  it("returns undefined for an empty invite list", () => {
    expect(matchInvite("spouse@example.com", [])).toBeUndefined();
  });

  it("prefers a pending invite over an accepted one for the same email", () => {
    const consumed = invite({ id: "old", status: "accepted" });
    const pending = invite({ id: "new", status: "pending" });
    expect(matchInvite("spouse@example.com", [consumed, pending])).toBe(pending);
  });

  it("returns the first pending match when duplicates exist", () => {
    const first = invite({ id: "first" });
    const second = invite({ id: "second" });
    expect(matchInvite("spouse@example.com", [first, second])).toBe(first);
  });
});
