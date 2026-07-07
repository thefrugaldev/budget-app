"use server";

import { revalidatePath } from "next/cache";

import { normalizeEmail } from "@/lib/auth";
import { requireRole } from "@/lib/auth/require-role";
import { isDuplicateKeyError } from "@/lib/db/errors";
import { requireHouseholdId } from "@/lib/auth/session";
import {
  createInvite,
  deleteInvite,
  listInvitesByHousehold,
} from "@/lib/repositories/invites";
import {
  deleteMember,
  listMembersByHousehold,
  updateMemberRole,
} from "@/lib/repositories/members";
import { listUsersByIds } from "@/lib/repositories/users";

import {
  parseInvitableRole,
  parseInviteEmail,
  parseInviteId,
  parseUserId,
} from "./member-parsers";
import type { MemberActionState } from "./members-state";

function success(prev: MemberActionState): MemberActionState {
  return { error: null, ok: prev.ok + 1 };
}

function failure(prev: MemberActionState, err: unknown): MemberActionState {
  const message = err instanceof Error ? err.message : "Something went wrong";
  return { error: message, ok: prev.ok };
}

/**
 * The set of member emails in a household, normalized for comparison. Used to
 * reject inviting someone who is already a member — the invite would be dead
 * (they resolve by membership on sign-in, never reaching invite matching).
 */
async function memberEmails(householdId: string): Promise<Set<string>> {
  const members = await listMembersByHousehold(householdId);
  const users = await listUsersByIds(members.map((m) => m.userId));
  return new Set(users.map((u) => normalizeEmail(u.email)));
}

/**
 * Create a pending invite (owner action — story 4). All authorization is
 * server-side (`requireRole("owner")`); hiding the form is never the boundary
 * (story 13). Rejects an email that already belongs to a member or already has
 * a pending invite, with the DB's partial-unique index as the race backstop.
 *
 * No email is sent (ADR 0004): the invitee is provisioned manually in Clerk and
 * signs in with the matching Google account, which consumes the invite. The UI
 * surfaces that manual step on success.
 */
export async function createInviteAction(
  prev: MemberActionState,
  formData: FormData,
): Promise<MemberActionState> {
  try {
    await requireRole("owner");
    const householdId = await requireHouseholdId();
    const email = parseInviteEmail(formData.get("email"));
    const role = parseInvitableRole(formData.get("role"));

    if ((await memberEmails(householdId)).has(email)) {
      throw new Error("That email already belongs to a member");
    }
    const invites = await listInvitesByHousehold(householdId);
    if (
      invites.some(
        (i) => i.status === "pending" && normalizeEmail(i.email) === email,
      )
    ) {
      throw new Error("That email already has a pending invite");
    }

    try {
      await createInvite({ householdId, email, role });
    } catch (err) {
      // Lost a race to a concurrent invite for the same email — the partial-
      // unique index rejected the duplicate. Surface the same friendly copy.
      if (isDuplicateKeyError(err)) {
        throw new Error("That email already has a pending invite");
      }
      throw err;
    }

    revalidatePath("/settings");
    return success(prev);
  } catch (err) {
    return failure(prev, err);
  }
}

/**
 * Revoke a pending invite (owner action — story 11). Idempotent: a stale id or
 * an already-accepted/revoked invite is a no-op that still returns success, so a
 * double-click or a raced revoke doesn't surface a confusing error.
 */
export async function revokeInviteAction(
  prev: MemberActionState,
  formData: FormData,
): Promise<MemberActionState> {
  try {
    await requireRole("owner");
    const householdId = await requireHouseholdId();
    const inviteId = parseInviteId(formData.get("inviteId"));

    await deleteInvite(householdId, inviteId);
    revalidatePath("/settings");
    return success(prev);
  } catch (err) {
    return failure(prev, err);
  }
}

/**
 * Change a member's role between `editor` and `viewer` (owner action —
 * story 11). Refuses to touch the owner's own row: `owner` is exactly one per
 * household and transfer is out of scope (ADR 0004), so there's no path to a
 * second owner or an owner-less household.
 */
export async function changeMemberRoleAction(
  prev: MemberActionState,
  formData: FormData,
): Promise<MemberActionState> {
  try {
    await requireRole("owner");
    const householdId = await requireHouseholdId();
    const userId = parseUserId(formData.get("userId"));
    const role = parseInvitableRole(formData.get("role"));

    const members = await listMembersByHousehold(householdId);
    const target = members.find((m) => m.userId === userId);
    if (!target) throw new Error("Member not found");
    if (target.role === "owner") {
      throw new Error("The owner's role can't be changed");
    }

    await updateMemberRole(householdId, userId, role);
    revalidatePath("/settings");
    return success(prev);
  } catch (err) {
    return failure(prev, err);
  }
}

/**
 * Remove a member from the household (owner action — story 11). Refuses to
 * remove the owner (a household always has its owner). The removed person's
 * `User` and household-stamped data are left intact — this revokes access, it
 * doesn't erase a person or their history.
 */
export async function removeMemberAction(
  prev: MemberActionState,
  formData: FormData,
): Promise<MemberActionState> {
  try {
    await requireRole("owner");
    const householdId = await requireHouseholdId();
    const userId = parseUserId(formData.get("userId"));

    const members = await listMembersByHousehold(householdId);
    const target = members.find((m) => m.userId === userId);
    if (!target) throw new Error("Member not found");
    if (target.role === "owner") {
      throw new Error("The owner can't be removed");
    }

    await deleteMember(householdId, userId);
    revalidatePath("/settings");
    return success(prev);
  } catch (err) {
    return failure(prev, err);
  }
}
