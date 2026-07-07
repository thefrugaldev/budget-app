import { randomUUID } from "crypto";

import { getDb } from "@/lib/db/client";
import { COLLECTIONS } from "@/lib/db/collections";
import type { MemberDocument } from "@/lib/db/documents";
import { toMember } from "@/lib/db/mappers";
import type { InvitableRole, Member, Role } from "@/types/auth";

/**
 * The user's membership, or undefined if they belong to no household. Resolved
 * once per request by the boundary (chunk 3/4) and fed to `authorize`. A user
 * has at most one membership in v1 (single household), so this is a `findOne`.
 */
export async function findMemberByUserId(
  userId: string,
): Promise<Member | undefined> {
  const db = await getDb();

  const doc = await db
    .collection<MemberDocument>(COLLECTIONS.members)
    .findOne({ userId });
  return doc ? toMember(doc) : undefined;
}

/**
 * Create a membership — the owner on bootstrap, or an invited user's role on a
 * matched sign-in (chunk 3). The role is chosen by the caller from the bootstrap
 * (`owner`) or the consumed invite (`editor`/`viewer`).
 */
export async function createMember(input: {
  householdId: string;
  userId: string;
  role: Role;
}): Promise<Member> {
  const db = await getDb();

  const doc: MemberDocument = {
    _id: randomUUID(),
    householdId: input.householdId,
    userId: input.userId,
    role: input.role,
    createdAt: new Date(),
  };

  await db.collection<MemberDocument>(COLLECTIONS.members).insertOne(doc);
  return toMember(doc);
}

/**
 * Every member of a household, for the owner's Members list (chunk 6). Scoped to
 * `householdId` even though v1 has a single household — the query never assumes
 * global uniqueness, so it stays correct if multiple households ever land.
 */
export async function listMembersByHousehold(
  householdId: string,
): Promise<Member[]> {
  const db = await getDb();

  const docs = await db
    .collection<MemberDocument>(COLLECTIONS.members)
    .find({ householdId })
    .toArray();
  return docs.map(toMember);
}

/**
 * Change a member's role (owner action, chunk 6). Scoped to `(householdId,
 * userId)` and to an `InvitableRole` — the owner can promote/demote between
 * `editor` and `viewer` but never mint a second `owner` (transfer is out of
 * scope, ADR 0004); the action layer additionally refuses to touch the owner's
 * own row. Returns whether a row changed, so a no-op (missing member, or the
 * role already set) is distinguishable from a real update.
 */
export async function updateMemberRole(
  householdId: string,
  userId: string,
  role: InvitableRole,
): Promise<boolean> {
  const db = await getDb();

  const result = await db
    .collection<MemberDocument>(COLLECTIONS.members)
    .updateOne({ householdId, userId }, { $set: { role } });
  return result.modifiedCount > 0;
}

/**
 * Remove a member from the household (owner action, chunk 6): their access is
 * revoked, but their `User` and data (already household-stamped) stay — removing
 * a member is not deleting a person. Scoped to `(householdId, userId)`; the
 * action layer refuses to remove the owner. Returns whether a row was deleted.
 */
export async function deleteMember(
  householdId: string,
  userId: string,
): Promise<boolean> {
  const db = await getDb();

  const result = await db
    .collection<MemberDocument>(COLLECTIONS.members)
    .deleteOne({ householdId, userId });
  return result.deletedCount > 0;
}
