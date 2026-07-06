import { requireHouseholdId } from "@/lib/auth/session";

import { getDb } from "./client";
import { COLLECTIONS } from "./collections";
import type { MetaDocument } from "./documents";
import { autoSeedDisabledId } from "./seed";

/**
 * Danger-zone reset (#81 story 9): permanently clears every user-data
 * collection (transactions, categories, and their target history) and records
 * the auto-seed-disabled marker so {@link ensureSeeded} never refills the
 * deliberately-emptied database on a later cold start. Leaves the app in a true
 * blank slate. Local data only — there is no remote/account state to touch yet.
 *
 * The marker is written **first, on purpose**: MongoDB has no cross-collection
 * transaction guarantee here, so a delete could partially fail. By disabling
 * auto-seed up front, any outcome — full wipe, partial wipe, or total delete
 * failure — is safe: the app never re-inserts seed categories that could
 * collide with survivors. A marker on a still-populated DB (all deletes failed)
 * is inert, since a non-empty DB is never auto-seeded anyway, and the caller
 * surfaces the error so the reset can be retried. `clearedAt` is recorded for
 * observability only — nothing reads it today.
 *
 * NB: when a new user-data collection is added, clear it here too.
 */
export async function resetAllData(): Promise<void> {
  const householdId = await requireHouseholdId();
  const db = await getDb();

  // Per-household marker id, so two households (or a re-bootstrap after a
  // delete-household) never dup-key on a shared `_id`. The `householdId` field
  // is still stamped for tenancy-consistent reads.
  await db
    .collection<MetaDocument>(COLLECTIONS.meta)
    .updateOne(
      { _id: autoSeedDisabledId(householdId) },
      { $set: { clearedAt: new Date(), householdId } },
      { upsert: true },
    );

  // Only this household's data — a reset never reaches another household's docs.
  await Promise.all([
    db.collection(COLLECTIONS.transactions).deleteMany({ householdId }),
    db.collection(COLLECTIONS.categories).deleteMany({ householdId }),
    db.collection(COLLECTIONS.categoryTargets).deleteMany({ householdId }),
  ]);
}
