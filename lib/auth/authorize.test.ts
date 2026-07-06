import { describe, expect, it } from "vitest";

import {
  authorize,
  authorizeSession,
  denialMessage,
  roleSatisfies,
} from "@/lib/auth/authorize";
import type { DenyReason, Member, ResolvedSession, Role, User } from "@/types/auth";

const user: User = {
  id: "u1",
  email: "owner@example.com",
  provider: { provider: "clerk", subjectId: "clerk_1" },
};

function member(over: Partial<Member> = {}): Member {
  return { userId: "u1", householdId: "h1", role: "editor", ...over };
}

describe("roleSatisfies", () => {
  // viewer(0) < editor(1) < owner(2): a role clears every gate at or below it.
  const cases: Array<[Role, Role, boolean]> = [
    ["owner", "owner", true],
    ["owner", "editor", true],
    ["owner", "viewer", true],
    ["editor", "owner", false],
    ["editor", "editor", true],
    ["editor", "viewer", true],
    ["viewer", "owner", false],
    ["viewer", "editor", false],
    ["viewer", "viewer", true],
  ];

  it.each(cases)("%s satisfies required %s → %s", (role, required, expected) => {
    expect(roleSatisfies(role, required)).toBe(expected);
  });
});

describe("authorize", () => {
  it("denies with no-session when there is no user", () => {
    expect(authorize(null, member(), "viewer")).toEqual({
      allowed: false,
      reason: "no-session",
    });
  });

  it("denies with no-membership when the user has none", () => {
    expect(authorize(user, null, "viewer")).toEqual({
      allowed: false,
      reason: "no-membership",
    });
  });

  it("treats a membership belonging to another user as absent", () => {
    expect(authorize(user, member({ userId: "someone-else" }), "viewer")).toEqual(
      { allowed: false, reason: "no-membership" },
    );
  });

  it("denies with insufficient-role when the role is too low", () => {
    expect(authorize(user, member({ role: "viewer" }), "editor")).toEqual({
      allowed: false,
      reason: "insufficient-role",
    });
    expect(authorize(user, member({ role: "editor" }), "owner")).toEqual({
      allowed: false,
      reason: "insufficient-role",
    });
  });

  it("allows when the role meets or exceeds the requirement", () => {
    expect(authorize(user, member({ role: "editor" }), "editor")).toEqual({
      allowed: true,
    });
    expect(authorize(user, member({ role: "owner" }), "editor")).toEqual({
      allowed: true,
    });
    expect(authorize(user, member({ role: "viewer" }), "viewer")).toEqual({
      allowed: true,
    });
  });

  it("checks role before privilege — a no-session user is denied even for a viewer gate", () => {
    // Ordering guard: session absence outranks any role consideration.
    expect(authorize(null, member({ role: "owner" }), "viewer").allowed).toBe(
      false,
    );
  });
});

describe("authorizeSession", () => {
  it("maps a signed-out session to no-session (a real sign-in fixes it)", () => {
    const session: ResolvedSession = { status: "signed-out" };
    expect(authorizeSession(session, "editor")).toEqual({
      allowed: false,
      reason: "no-session",
    });
  });

  it("maps a denied session to no-membership, NOT no-session (#111 chunk 5)", () => {
    // The load-bearing fix: an authenticated-but-membership-less person must not
    // read as "no session" — that would bounce them to sign-in and loop straight
    // back to denied. They're signed in; they just lack access.
    const session: ResolvedSession = { status: "denied" };
    expect(authorizeSession(session, "editor")).toEqual({
      allowed: false,
      reason: "no-membership",
    });
  });

  it("defers to the role check for an active session", () => {
    const active = (role: Role): ResolvedSession => ({
      status: "active",
      user,
      membership: member({ role }),
    });
    expect(authorizeSession(active("editor"), "editor")).toEqual({
      allowed: true,
    });
    expect(authorizeSession(active("owner"), "editor")).toEqual({
      allowed: true,
    });
    expect(authorizeSession(active("viewer"), "editor")).toEqual({
      allowed: false,
      reason: "insufficient-role",
    });
    expect(authorizeSession(active("editor"), "owner")).toEqual({
      allowed: false,
      reason: "insufficient-role",
    });
  });
});

describe("denialMessage", () => {
  const reasons: DenyReason[] = [
    "no-session",
    "no-membership",
    "insufficient-role",
  ];

  it.each(reasons)("returns distinct, non-empty user-facing copy for %s", (reason) => {
    expect(denialMessage(reason)).toBeTruthy();
  });

  it("gives each reason its own message", () => {
    const messages = reasons.map(denialMessage);
    expect(new Set(messages).size).toBe(reasons.length);
  });
});
