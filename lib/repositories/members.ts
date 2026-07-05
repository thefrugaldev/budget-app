import { randomUUID } from "crypto";

import { getDb } from "@/lib/db/client";
import { COLLECTIONS } from "@/lib/db/collections";
import type { MemberDocument } from "@/lib/db/documents";
import { toMember } from "@/lib/db/mappers";
import type { Member, Role } from "@/types/auth";

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
