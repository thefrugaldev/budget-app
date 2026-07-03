import { describe, expect, it } from "vitest";

import { authorize, roleSatisfies } from "@/lib/auth/authorize";
import type { Member, Role, User } from "@/types/auth";

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
