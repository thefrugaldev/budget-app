import { describe, expect, it } from "vitest";

import { decideSignIn } from "@/lib/auth/sign-in";
import type { Invite, Member } from "@/types/auth";

function invite(over: Partial<Invite> & { id: string }): Invite {
  return {
    householdId: "h1",
    email: "spouse@example.com",
    role: "editor",
    status: "pending",
    ...over,
  };
}

const membership: Member = { userId: "u1", householdId: "h1", role: "viewer" };

describe("decideSignIn", () => {
  it("bootstraps when no household exists (the first sign-in ever)", () => {
    expect(
      decideSignIn({
        email: "owner@example.com",
        householdExists: false,
        membership: null,
        invites: [],
      }),
    ).toEqual({ kind: "bootstrap" });
  });

  it("enters with the existing membership's role for a returning member", () => {
    expect(
      decideSignIn({
        email: "owner@example.com",
        householdExists: true,
        membership,
        invites: [],
      }),
    ).toEqual({ kind: "enter", role: "viewer" });
  });

  it("joins with the invite's role on a matching pending invite", () => {
    const inv = invite({ id: "i1", role: "editor" });
    expect(
      decideSignIn({
        email: "Spouse@Example.com",
        householdExists: true,
        membership: null,
        invites: [inv],
      }),
    ).toEqual({ kind: "join", invite: inv });
  });

  it("denies an authenticated but uninvited user", () => {
    expect(
      decideSignIn({
        email: "stranger@example.com",
        householdExists: true,
        membership: null,
        invites: [invite({ id: "i1" })],
      }),
    ).toEqual({ kind: "deny" });
  });

  it("prefers an existing membership over a matching invite (already-member)", () => {
    expect(
      decideSignIn({
        email: "spouse@example.com",
        householdExists: true,
        membership: { ...membership, role: "editor" },
        invites: [invite({ id: "i1", role: "viewer" })],
      }),
    ).toEqual({ kind: "enter", role: "editor" });
  });

  it("bootstrap takes precedence over everything when no household exists", () => {
    expect(
      decideSignIn({
        email: "spouse@example.com",
        householdExists: false,
        membership,
        invites: [invite({ id: "i1" })],
      }),
    ).toEqual({ kind: "bootstrap" });
  });

  it("denies when only a consumed invite matches the email", () => {
    expect(
      decideSignIn({
        email: "spouse@example.com",
        householdExists: true,
        membership: null,
        invites: [invite({ id: "i1", status: "accepted" })],
      }),
    ).toEqual({ kind: "deny" });
  });
});
