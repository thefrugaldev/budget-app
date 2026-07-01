import { getDb } from "./client";
import { COLLECTIONS } from "./collections";
import type { MetaDocument } from "./documents";
import { AUTO_SEED_DISABLED_ID } from "./seed";

/**
 * Danger-zone reset (#81 story 9): permanently clears every user-data
 * collection (transactions, categories, and their target history) and records
 * the auto-seed-disabled marker so {@link ensureSeeded} never refills the
 * deliberately-emptied database on a later cold start. Leaves the app in a true
 * blank slate. Local data only — there is no remote/account state to touch yet.
 */
export async function resetAllData(): Promise<void> {
  const db = await getDb();

  await Promise.all([
    db.collection(COLLECTIONS.transactions).deleteMany({}),
    db.collection(COLLECTIONS.categories).deleteMany({}),
    db.collection(COLLECTIONS.categoryTargets).deleteMany({}),
  ]);

  await db
    .collection<MetaDocument>(COLLECTIONS.meta)
    .updateOne(
      { _id: AUTO_SEED_DISABLED_ID },
      { $set: { clearedAt: new Date() } },
      { upsert: true },
    );
}
