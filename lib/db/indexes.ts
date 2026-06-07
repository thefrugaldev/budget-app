import type { Db } from "mongodb";

import { COLLECTIONS } from "./collections";

let indexesReady: Promise<void> | undefined;

// Portable single-field indexes only (Atlas + Cosmos Mongo API).
export function ensureIndexes(db: Db): Promise<void> {
  if (!indexesReady) {
    indexesReady = Promise.all([
      db
        .collection(COLLECTIONS.categories)
        .createIndex({ name: 1 }, { unique: true }),
      db
        .collection(COLLECTIONS.categoryTargets)
        .createIndex({ categoryId: 1 }),
      db.collection(COLLECTIONS.transactions).createIndex({ date: 1 }),
      db
        .collection(COLLECTIONS.transactions)
        .createIndex({ categoryId: 1, date: 1 }),
    ]).then(() => undefined);
  }

  return indexesReady;
}
