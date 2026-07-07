import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Invite, Member, User } from "@/types/auth";

// `session.ts` imports `server-only` (throws in vitest's node env) and the Clerk
// boundary + repositories (DB/SDK). Neutralize `server-only` and mock the
// side-effecting collaborators so `resolveSignIn`'s orchestration — the
// create-vs-reuse-identity branch that makes re-admission work without a
// dup-key (ADR 0004, load-bearing) — is testable without Clerk or Mongo.
vi.mock("server-only", () => ({}));
vi.mock("./clerk", () => ({
  getClerkSubjectId: vi.fn(),
  getClerkVerifiedEmail: vi.fn(),
}));
vi.mock("@/lib/repositories/users", () => ({
  createUser: vi.fn(),
  findUserByProviderSubject: vi.fn(),
  updateUserEmail: vi.fn(),
}));
vi.mock("@/lib/repositories/households", () => ({
  getHousehold: vi.fn(),
  createHousehold: vi.fn(),
}));
vi.mock("@/lib/repositories/invites", () => ({
  listInvitesByHousehold: vi.fn(),
  consumeInvite: vi.fn(),
}));
vi.mock("@/lib/repositories/members", () => ({
  createMember: vi.fn(),
  findMemberByUserId: vi.fn(),
}));
vi.mock("@/lib/db/backfill", () => ({ runBackfill: vi.fn() }));

import { getClerkVerifiedEmail } from "./clerk";
import { resolveSignIn } from "./session";
import { getHousehold, createHousehold } from "@/lib/repositories/households";
import { consumeInvite, listInvitesByHousehold } from "@/lib/repositories/invites";
import { createMember } from "@/lib/repositories/members";
import { createUser, updateUserEmail } from "@/lib/repositories/users";

const SUBJECT = "clerk_subject_1";
const HOUSEHOLD_ID = "hh_1";

const pendingInvite: Invite = {
  id: "invite_1",
  householdId: HOUSEHOLD_ID,
  email: "invitee@example.com",
  role: "editor",
  status: "pending",
};

const removedUser: User = {
  id: "user_existing",
  email: "invitee@example.com",
  provider: { provider: "clerk", subjectId: SUBJECT },
};

beforeEach(() => {
  vi.clearAllMocks();
  // Defaults: a household exists, and createX return believable records.
  vi.mocked(getHousehold).mockResolvedValue({ id: HOUSEHOLD_ID });
  vi.mocked(listInvitesByHousehold).mockResolvedValue([]);
  vi.mocked(consumeInvite).mockResolvedValue(true);
  vi.mocked(createHousehold).mockResolvedValue({ id: "hh_new" });
  vi.mocked(createUser).mockResolvedValue({
    id: "user_new",
    email: "invitee@example.com",
    provider: { provider: "clerk", subjectId: SUBJECT },
  });
  vi.mocked(createMember).mockImplementation(
    async (input): Promise<Member> => ({
      userId: input.userId,
      householdId: input.householdId,
      role: input.role,
    }),
  );
});

describe("resolveSignIn — never-seen identity", () => {
  it("creates a user and joins on a matching pending invite", async () => {
    vi.mocked(getClerkVerifiedEmail).mockResolvedValue("invitee@example.com");
    vi.mocked(listInvitesByHousehold).mockResolvedValue([pendingInvite]);

    const result = await resolveSignIn(null, SUBJECT);

    expect(createUser).toHaveBeenCalledOnce();
    expect(createMember).toHaveBeenCalledWith({
      householdId: HOUSEHOLD_ID,
      userId: "user_new",
      role: "editor",
    });
    expect(consumeInvite).toHaveBeenCalledWith("invite_1");
    expect(result).toEqual({
      status: "active",
      user: expect.objectContaining({ id: "user_new" }),
      membership: expect.objectContaining({ role: "editor" }),
    });
  });

  it("denies with no residue when no invite matches", async () => {
    vi.mocked(getClerkVerifiedEmail).mockResolvedValue("stranger@example.com");
    vi.mocked(listInvitesByHousehold).mockResolvedValue([pendingInvite]);

    const result = await resolveSignIn(null, SUBJECT);

    expect(result).toEqual({ status: "denied" });
    expect(createUser).not.toHaveBeenCalled();
    expect(createMember).not.toHaveBeenCalled();
    expect(consumeInvite).not.toHaveBeenCalled();
  });

  it("denies when there is no verified email", async () => {
    vi.mocked(getClerkVerifiedEmail).mockResolvedValue(null);

    const result = await resolveSignIn(null, SUBJECT);

    expect(result).toEqual({ status: "denied" });
    expect(createUser).not.toHaveBeenCalled();
  });
});

describe("resolveSignIn — re-admission of a removed identity", () => {
  it("reuses the existing user instead of creating one (no dup-key)", async () => {
    vi.mocked(getClerkVerifiedEmail).mockResolvedValue("invitee@example.com");
    vi.mocked(listInvitesByHousehold).mockResolvedValue([pendingInvite]);

    const result = await resolveSignIn(removedUser, SUBJECT);

    // The load-bearing invariant: a returning identity is reused, never re-created.
    expect(createUser).not.toHaveBeenCalled();
    expect(createMember).toHaveBeenCalledWith({
      householdId: HOUSEHOLD_ID,
      userId: "user_existing",
      role: "editor",
    });
    expect(consumeInvite).toHaveBeenCalledWith("invite_1");
    expect(result).toMatchObject({
      status: "active",
      user: { id: "user_existing" },
    });
  });

  it("refreshes the stored email when the verified email has drifted", async () => {
    vi.mocked(getClerkVerifiedEmail).mockResolvedValue("invitee@example.com");
    vi.mocked(listInvitesByHousehold).mockResolvedValue([pendingInvite]);
    const staleUser: User = { ...removedUser, email: "old@example.com" };

    const result = await resolveSignIn(staleUser, SUBJECT);

    expect(updateUserEmail).toHaveBeenCalledWith(
      "user_existing",
      "invitee@example.com",
    );
    expect(createUser).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      status: "active",
      user: { id: "user_existing", email: "invitee@example.com" },
    });
  });

  it("does not touch the stored email when it already matches", async () => {
    vi.mocked(getClerkVerifiedEmail).mockResolvedValue("invitee@example.com");
    vi.mocked(listInvitesByHousehold).mockResolvedValue([pendingInvite]);

    await resolveSignIn(removedUser, SUBJECT);

    expect(updateUserEmail).not.toHaveBeenCalled();
  });

  it("denies a removed identity with no matching invite", async () => {
    vi.mocked(getClerkVerifiedEmail).mockResolvedValue("invitee@example.com");
    vi.mocked(listInvitesByHousehold).mockResolvedValue([]);

    const result = await resolveSignIn(removedUser, SUBJECT);

    expect(result).toEqual({ status: "denied" });
    expect(createMember).not.toHaveBeenCalled();
  });
});

describe("resolveSignIn — bootstrap", () => {
  it("bootstraps a household for a never-seen identity when none exists", async () => {
    vi.mocked(getClerkVerifiedEmail).mockResolvedValue("owner@example.com");
    vi.mocked(getHousehold).mockResolvedValue(undefined);

    const result = await resolveSignIn(null, SUBJECT);

    expect(createUser).toHaveBeenCalledOnce();
    expect(createHousehold).toHaveBeenCalledOnce();
    expect(createMember).toHaveBeenCalledWith({
      householdId: "hh_new",
      userId: "user_new",
      role: "owner",
    });
    expect(result).toMatchObject({ status: "active" });
  });

  it("reuses the existing identity when bootstrapping post-reset", async () => {
    vi.mocked(getClerkVerifiedEmail).mockResolvedValue("invitee@example.com");
    vi.mocked(getHousehold).mockResolvedValue(undefined);

    await resolveSignIn(removedUser, SUBJECT);

    expect(createUser).not.toHaveBeenCalled();
    expect(createMember).toHaveBeenCalledWith({
      householdId: "hh_new",
      userId: "user_existing",
      role: "owner",
    });
  });
});
