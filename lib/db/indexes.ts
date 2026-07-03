import type { Db } from "mongodb";

import { COLLECTIONS } from "./collections";

let indexesReady: Promise<void> | undefined;

/**
 * Portable single-field indexes only (Atlas + Cosmos Mongo API). The
 * categories collection deliberately has no name index: multiple categories
 * may share a name (two "Bonus" income sources in the same year, two
 * "Schooling" expense categories across life phases), and the collection is
 * small enough that `.sort({ name: 1 })` in listCategories doesn't need one.
 * Earlier revisions created `{ name: 1 }` with `unique: true`, which now
 * actively blocks legitimate inserts — `dropIndex` cleans that up idempotently
 * on the next boot. Treat any error from dropIndex as "index not present",
 * which is the desired terminal state.
 */
export function ensureIndexes(db: Db): Promise<void> {
  if (!indexesReady) {
    indexesReady = buildIndexes(db).catch((err) => {
      // Reset the memo so the next getDb retries a transient index build,
      // rather than permanently poisoning every DB access with the rejected
      // promise. Mirrors ensureSeeded's reset-on-failure (lib/db/seed.ts) —
      // load-bearing now that ensureIndexes sits on getDb's critical path.
      indexesReady = undefined;
      throw err;
    });
  }

  return indexesReady;
}

function buildIndexes(db: Db): Promise<void> {
  return Promise.all([
    db
      .collection(COLLECTIONS.categories)
      .dropIndex("name_1")
      .catch((err: { code?: number }) => {
        // 27 = `IndexNotFound`. Anything else (permissions, connectivity)
        // surfaces — silently swallowing those would mask real ops issues.
        if (err?.code !== 27) throw err;
      }),
    db
      .collection(COLLECTIONS.categoryTargets)
      .createIndex({ categoryId: 1, effectiveFrom: 1 }, { unique: true }),
    db.collection(COLLECTIONS.transactions).createIndex({ date: 1 }),
    db.collection(COLLECTIONS.transactions).createIndex({ categoryId: 1, date: 1 }),
    // Auth collections (#111 chunk 2). A user has exactly one identity record
    // and at most one membership in v1, so both lookups are unique. Invites
    // are listed per household (matching is in-app via `matchInvite`).
    db
      .collection(COLLECTIONS.users)
      .createIndex({ providerSubjectId: 1 }, { unique: true }),
    db.collection(COLLECTIONS.members).createIndex({ userId: 1 }, { unique: true }),
    db.collection(COLLECTIONS.invites).createIndex({ householdId: 1 }),
  ]).then(() => undefined);
}
