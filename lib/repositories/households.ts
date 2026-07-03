import { randomUUID } from "crypto";

import { getDb } from "@/lib/db/client";
import { COLLECTIONS } from "@/lib/db/collections";
import type { HouseholdDocument } from "@/lib/db/documents";
import { ensureIndexes } from "@/lib/db/indexes";
import { toHousehold } from "@/lib/db/mappers";
import type { Household } from "@/types/auth";

/**
 * The household, or undefined if none exists yet. Exactly one household exists
 * in v1 (bootstrap-created; multiple households are out of scope), so a plain
 * `findOne` is the single-household accessor. Chunk 3 derives the bootstrap
 * decision from whether this returns a value (`decideSignIn`'s `householdExists`).
 */
export async function getHousehold(): Promise<Household | undefined> {
  const db = await getDb();
  await ensureIndexes(db);

  const doc = await db
    .collection<HouseholdDocument>(COLLECTIONS.households)
    .findOne({});
  return doc ? toHousehold(doc) : undefined;
}

/**
 * Create the household on the very first sign-in (bootstrap). The caller (chunk
 * 3) then makes that user its owner and runs the backfill; this only mints the
 * record.
 */
export async function createHousehold(): Promise<Household> {
  const db = await getDb();
  await ensureIndexes(db);

  const doc: HouseholdDocument = {
    _id: randomUUID(),
    createdAt: new Date(),
  };

  await db
    .collection<HouseholdDocument>(COLLECTIONS.households)
    .insertOne(doc);
  return toHousehold(doc);
}
