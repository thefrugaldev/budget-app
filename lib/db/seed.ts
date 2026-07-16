// One-time idempotent seed for the dev database. Runs on first page load
// when the `categories` collection is empty, then no-ops on subsequent
// requests within the process (cached promise) and across process restarts
// (collection is no longer empty).
//
// Includes a single seed income category (Salary) so the Pulse header has a
// baseline to display the first time a fresh DB is rendered.

import type { Db } from "mongodb";

import { getDb } from "./client";
import { COLLECTIONS } from "./collections";
import type {
  CategoryDocument,
  CategoryTargetDocument,
  MetaDocument,
  TransactionDocument,
} from "./documents";
import { AUTO_SEED_DISABLED_ID, autoSeedDisabledId } from "./seed-marker";
import { SEED_CATEGORIES, SEED_TRANSACTIONS, seedDocId } from "./seed-data";
import type { SeedCategory } from "./seed-data";

// The marker-id helpers moved to `./seed-marker`, and the seed dataset + id
// scheme to `./seed-data` — both pure, no `next/server` — so non-Next callers
// (the archive `apply` CLI, #118) can import them without the request runtime.
// Re-exported here for existing callers (`reset.ts`, tests).
export { AUTO_SEED_DISABLED_ID, autoSeedDisabledId };
export { seedDocId };

/**
 * Pure decision for {@link doSeed}: seed a fresh DB, backfill a populated one
 * with any newly-shipped seed categories, or skip entirely once the user has
 * explicitly cleared their data. Extracted so the "cleared stays cleared"
 * invariant is unit-testable without a database.
 */
export function resolveSeedAction(input: {
  autoSeedDisabled: boolean;
  hasCategories: boolean;
}): "seed" | "backfill" | "skip" {
  if (input.autoSeedDisabled) return "skip";
  return input.hasCategories ? "backfill" : "seed";
}

// Keyed by householdId so each household's demo seed runs at most once per
// process. In v1 there is exactly one household, but keying (rather than a lone
// module promise) keeps the "seeded once" invariant correct if a second one
// ever signs in — and, together with the per-household `_id` namespacing
// (`seedDocId`) and marker id (`autoSeedDisabledId`), lets a fresh household
// actually seed rather than dup-keying on another household's docs (#120 review).
const seedPromises = new Map<string, Promise<void>>();

/**
 * Seed the demo data for `householdId`, once per process per household.
 *
 * Takes the household id explicitly (rather than resolving the session here)
 * for two reasons: it mirrors `runBackfill`, the other bootstrap-adjacent write
 * path, which is also handed its household id; and it keeps this module — whose
 * pure `resolveSeedAction` is unit-tested — free of the Clerk/`server-only`
 * import chain the session boundary carries. Callers resolve `requireHouseholdId`
 * (they run inside the session-gated app shell) and pass it in.
 */
export function ensureSeeded(householdId: string): Promise<void> {
  let promise = seedPromises.get(householdId);
  if (!promise) {
    promise = doSeed(householdId).catch((err) => {
      seedPromises.delete(householdId);
      throw err;
    });
    seedPromises.set(householdId, promise);
  }
  return promise;
}

async function doSeed(householdId: string): Promise<void> {
  const db = await getDb();

  const now = new Date();
  const [disabledCount, categoryCount] = await Promise.all([
    db.collection<MetaDocument>(COLLECTIONS.meta).countDocuments(
      {
        $or: [
          { _id: autoSeedDisabledId(householdId) },
          // Legacy pre-auth marker (a danger-zone reset before auth existed),
          // adopted into this household by the bootstrap backfill. Still honored
          // so a deliberately-cleared DB isn't re-seeded on first sign-in.
          { _id: AUTO_SEED_DISABLED_ID, householdId },
        ],
      },
      { limit: 1 },
    ),
    db
      .collection(COLLECTIONS.categories)
      .countDocuments({ householdId }, { limit: 1 }),
  ]);

  const action = resolveSeedAction({
    autoSeedDisabled: disabledCount > 0,
    hasCategories: categoryCount > 0,
  });

  switch (action) {
    case "seed":
      await seedCategories(db, householdId, now);
      await seedTargets(db, householdId, now);
      await seedTransactions(db, householdId, now);
      return;
    case "backfill":
      // DB already populated — backfill any categories added since this DB was
      // first seeded (e.g. the income source introduced in chunk 6). Keyed on
      // `_id`, so a user-renamed seed category isn't re-inserted.
      await backfillMissingCategories(db, householdId, now);
      return;
    case "skip":
      // Explicitly cleared via the danger zone — respect the empty slate.
      return;
  }
}

// Omit optional fields when absent so Mongo doesn't persist `null` (mirrors
// createCategory's null-avoidance, which the readers in mappers.ts rely on).
// Every doc is stamped with the seeding household so chunk 4's household-scoped
// reads surface the demo data (a fresh install looks unchanged for the owner).
function buildCategoryDoc(
  c: SeedCategory,
  householdId: string,
  now: Date,
): CategoryDocument {
  return {
    _id: seedDocId(householdId, c._id),
    householdId,
    source: "seed",
    name: c.name,
    emoji: c.emoji,
    kind: c.kind,
    activeFrom: c.activeFrom,
    createdAt: now,
    ...(c.activeUntil !== undefined ? { activeUntil: c.activeUntil } : {}),
    ...(c.incomeFrequency !== undefined
      ? { incomeFrequency: c.incomeFrequency }
      : {}),
    ...(c.payCadence !== undefined ? { payCadence: c.payCadence } : {}),
  };
}

// One-time income sources have no baseline, so they get no target row.
function buildTargetDoc(
  c: SeedCategory,
  householdId: string,
  now: Date,
): CategoryTargetDocument | undefined {
  if (c.initialMonthly === undefined) return undefined;
  return {
    _id: seedDocId(householdId, `${c._id}:${c.activeFrom}`),
    householdId,
    source: "seed",
    categoryId: seedDocId(householdId, c._id),
    monthly: c.initialMonthly,
    effectiveFrom: c.activeFrom,
    createdAt: now,
  };
}

async function backfillMissingCategories(
  db: Db,
  householdId: string,
  now: Date,
): Promise<void> {
  // A seed category counts as already present if this household has it under
  // either the namespaced id (seeded after per-household namespacing) or the
  // legacy bare id (a household first seeded before it, e.g. the owner's). We
  // look for both forms so an already-seeded household is never re-inserted as
  // duplicates; genuinely-missing categories are then inserted namespaced.
  const wantedIds = SEED_CATEGORIES.flatMap((c) => [
    c._id,
    seedDocId(householdId, c._id),
  ]);
  const existingIds = new Set(
    (
      await db
        .collection<CategoryDocument>(COLLECTIONS.categories)
        .find(
          { _id: { $in: wantedIds }, householdId },
          { projection: { _id: 1 } },
        )
        .toArray()
    ).map((d) => d._id),
  );
  const missing = SEED_CATEGORIES.filter(
    (c) =>
      !existingIds.has(c._id) && !existingIds.has(seedDocId(householdId, c._id)),
  );
  if (missing.length === 0) return;

  await db
    .collection<CategoryDocument>(COLLECTIONS.categories)
    .insertMany(missing.map((c) => buildCategoryDoc(c, householdId, now)));

  const targetDocs = missing
    .map((c) => buildTargetDoc(c, householdId, now))
    .filter((d): d is CategoryTargetDocument => d !== undefined);
  // A backfill of only one-time sources yields no targets — insertMany([]) throws.
  if (targetDocs.length > 0) {
    await db
      .collection<CategoryTargetDocument>(COLLECTIONS.categoryTargets)
      .insertMany(targetDocs);
  }
}

async function seedCategories(
  db: Db,
  householdId: string,
  now: Date,
): Promise<void> {
  await db
    .collection<CategoryDocument>(COLLECTIONS.categories)
    .insertMany(SEED_CATEGORIES.map((c) => buildCategoryDoc(c, householdId, now)));
}

async function seedTargets(
  db: Db,
  householdId: string,
  now: Date,
): Promise<void> {
  const docs = SEED_CATEGORIES.map((c) => buildTargetDoc(c, householdId, now)).filter(
    (d): d is CategoryTargetDocument => d !== undefined,
  );
  await db
    .collection<CategoryTargetDocument>(COLLECTIONS.categoryTargets)
    .insertMany(docs);
}

async function seedTransactions(
  db: Db,
  householdId: string,
  now: Date,
): Promise<void> {
  const docs: TransactionDocument[] = SEED_TRANSACTIONS.map((t) => ({
    ...t,
    _id: seedDocId(householdId, t._id),
    // Reference the namespaced category id so the seed transaction resolves to
    // its (also namespaced) category within this household.
    categoryId: seedDocId(householdId, t.categoryId),
    householdId,
    source: "seed",
    createdAt: now,
  }));
  await db
    .collection<TransactionDocument>(COLLECTIONS.transactions)
    .insertMany(docs);
}
