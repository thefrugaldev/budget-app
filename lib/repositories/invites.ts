import { randomUUID } from "crypto";

import { getDb } from "@/lib/db/client";
import { COLLECTIONS } from "@/lib/db/collections";
import type { InviteDocument } from "@/lib/db/documents";
import { toInvite } from "@/lib/db/mappers";
import type { Invite, InvitableRole } from "@/types/auth";

/**
 * Every invite for a household. The pure `matchInvite` (chunk 1) filters these
 * to a pending, email-matching one on sign-in — the repository stays a plain
 * fetch and leaves the matching (and status) logic to the tested core.
 */
export async function listInvitesByHousehold(
  householdId: string,
): Promise<Invite[]> {
  const db = await getDb();

  const docs = await db
    .collection<InviteDocument>(COLLECTIONS.invites)
    .find({ householdId })
    .toArray();
  return docs.map(toInvite);
}

/**
 * Create a pending invite (owner action, wired in chunk 6). `role` is an
 * `InvitableRole` — `owner` is bootstrap-only and never invitable (ADR 0004).
 */
export async function createInvite(input: {
  householdId: string;
  email: string;
  role: InvitableRole;
}): Promise<Invite> {
  const db = await getDb();

  const doc: InviteDocument = {
    _id: randomUUID(),
    householdId: input.householdId,
    email: input.email,
    role: input.role,
    status: "pending",
    createdAt: new Date(),
  };

  await db.collection<InviteDocument>(COLLECTIONS.invites).insertOne(doc);
  return toInvite(doc);
}

/**
 * Revoke a *pending* invite (owner action, chunk 6). Scoped to `(id,
 * householdId)` so an owner can only ever revoke an invite of their own
 * household, and filtered to `status: "pending"` so an already-accepted invite
 * is never deletable: if a matching sign-in consumed the invite between the
 * owner's stale render and their Revoke click, this no-ops rather than erasing
 * the `accepted` record (the only persistent link, with `acceptedAt`, between
 * the invite and the resulting membership). Returns whether a row was deleted —
 * a no-op (already accepted, already revoked, or a stale UI id) returns false,
 * so the action stays idempotent without lying about having removed something.
 */
export async function deleteInvite(
  householdId: string,
  id: string,
): Promise<boolean> {
  const db = await getDb();

  const result = await db
    .collection<InviteDocument>(COLLECTIONS.invites)
    .deleteOne({ _id: id, householdId, status: "pending" });
  return result.deletedCount > 0;
}

/**
 * Consume an invite when a matching sign-in joins the household (chunk 3): flip
 * it to `accepted` and stamp `acceptedAt` so it never re-grants access. Returns
 * whether a pending invite was actually consumed — a no-op (already accepted or
 * missing) returns false so the caller can detect a race.
 */
export async function consumeInvite(id: string): Promise<boolean> {
  const db = await getDb();

  const result = await db
    .collection<InviteDocument>(COLLECTIONS.invites)
    .updateOne(
      { _id: id, status: "pending" },
      { $set: { status: "accepted", acceptedAt: new Date() } },
    );
  return result.modifiedCount > 0;
}
