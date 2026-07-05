import { randomUUID } from "crypto";

import { getDb } from "@/lib/db/client";
import { COLLECTIONS } from "@/lib/db/collections";
import type { UserDocument } from "@/lib/db/documents";
import { toUser } from "@/lib/db/mappers";
import type { User } from "@/types/auth";

/**
 * Resolve our stable User from the provider's session subject (Clerk's user id).
 * The Clerk boundary (chunk 3) calls this after verifying a session; a `null`
 * means this authenticated person has no User record yet (first sign-in).
 */
export async function findUserByProviderSubject(
  providerSubjectId: string,
): Promise<User | undefined> {
  const db = await getDb();

  const doc = await db
    .collection<UserDocument>(COLLECTIONS.users)
    .findOne({ providerSubjectId });
  return doc ? toUser(doc) : undefined;
}

/**
 * Create our User record for a freshly-authenticated person. Stores the verified
 * email and the provider link; `provider` is fixed to `"clerk"` at v1 (ADR 0004
 * — adding a provider is a later, explicit change, not a silent widening).
 */
export async function createUser(input: {
  email: string;
  providerSubjectId: string;
}): Promise<User> {
  const db = await getDb();

  const doc: UserDocument = {
    _id: randomUUID(),
    email: input.email,
    provider: "clerk",
    providerSubjectId: input.providerSubjectId,
    createdAt: new Date(),
  };

  await db.collection<UserDocument>(COLLECTIONS.users).insertOne(doc);
  return toUser(doc);
}
