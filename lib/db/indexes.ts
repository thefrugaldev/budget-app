import type { Db } from "mongodb";

import { COLLECTIONS } from "./collections";

let indexesReady: Promise<void> | undefined;

/**
 * Ensure every collection's indexes exist, once per process (memoized).
 *
 * **Called by {@link getDb} — do not call directly from a repository.** Index
 * bootstrapping lives at the connection chokepoint so no query can run against
 * an unindexed collection; a repository that reached for this directly would be
 * re-doing what `getDb` already guarantees. Exported only so `getDb` (and the
 * co-located test of the reset-on-failure invariant) can reach it.
 *
 * Portable single-field indexes only (Atlas + Cosmos Mongo API). The categories
 * collection deliberately has no name index: multiple categories may share a
 * name (two "Bonus" income sources in the same year, two "Schooling" expense
 * categories across life phases), and the collection is small enough that
 * `.sort({ name: 1 })` in listCategories doesn't need one. Earlier revisions
 * created `{ name: 1 }` with `unique: true`, which now actively blocks
 * legitimate inserts — `dropIndex` cleans that up idempotently on the next boot.
 * Treat any error from dropIndex as "index not present", the desired terminal
 * state.
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
    // `categoryTargets` uniqueness is household-scoped (#120 review). Two
    // households can legitimately hold a target for the same categoryId at the
    // same effectiveFrom (seed categories share stable ids by design), so the
    // old global `{ categoryId, effectiveFrom }` unique would dup-key across the
    // tenancy boundary. Drop it and replace with a household-prefixed composite
    // unique — which doubles as the read index (its `householdId` prefix serves
    // the household-only filter, and it matches the `{ categoryId, effectiveFrom }`
    // sort in listCategoryTargets). `dropIndex` is idempotent: code 27 =
    // IndexNotFound on a DB that never had the old index.
    db
      .collection(COLLECTIONS.categoryTargets)
      .dropIndex("categoryId_1_effectiveFrom_1")
      .catch((err: { code?: number }) => {
        if (err?.code !== 27) throw err;
      }),
    db
      .collection(COLLECTIONS.categoryTargets)
      .createIndex(
        { householdId: 1, categoryId: 1, effectiveFrom: 1 },
        { unique: true },
      ),
    db.collection(COLLECTIONS.transactions).createIndex({ date: 1 }),
    db.collection(COLLECTIONS.transactions).createIndex({ categoryId: 1, date: 1 }),
    // Archive-import provenance (#118). Partial (only imported docs carry
    // `importRef`) to stay slim. Serves apply's per-file orphan sweep — an
    // anchored `^<file>!` regex over this household's imported docs — and the
    // reset-protection filter (`importRef` presence) that lands in chunk 5.
    db
      .collection(COLLECTIONS.transactions)
      .createIndex(
        { importRef: 1 },
        { partialFilterExpression: { importRef: { $exists: true } } },
      ),
    db
      .collection(COLLECTIONS.categoryTargets)
      .createIndex(
        { importRef: 1 },
        { partialFilterExpression: { importRef: { $exists: true } } },
      ),
    // Household-scoped reads (#111 chunk 4): every user-data query filters by
    // `householdId`. Compound `{ householdId, name }` on categories serves both
    // listCategories's filter and its `.sort({ name: 1 })` from the index; the
    // categoryTargets filter rides the composite unique index above; compound
    // `{ householdId, date }` on transactions serves the month-range and
    // full-history reads, which always pair the household with a date sort.
    db.collection(COLLECTIONS.categories).createIndex({ householdId: 1, name: 1 }),
    db.collection(COLLECTIONS.transactions).createIndex({ householdId: 1, date: 1 }),
    // Net Worth (#109 chunk 2). Accounts list per household sorted by name;
    // snapshots read per household per account in date order (the carry-forward
    // history series and per-account queries), which the compound key serves
    // and its `householdId` prefix also covers the household-only filter.
    db.collection(COLLECTIONS.accounts).createIndex({ householdId: 1, name: 1 }),
    // Archive-import provenance on the Net Worth collections (#118 chunk 7),
    // mirroring the transactions/categoryTargets partial indexes: serves apply's
    // per-file snapshot orphan sweep and the danger-zone reset's importRef filter.
    db
      .collection(COLLECTIONS.accounts)
      .createIndex(
        { importRef: 1 },
        { partialFilterExpression: { importRef: { $exists: true } } },
      ),
    db
      .collection(COLLECTIONS.snapshots)
      .createIndex(
        { importRef: 1 },
        { partialFilterExpression: { importRef: { $exists: true } } },
      ),
    // Snapshots are day-grain — at most one per (household, account, date). The
    // createSnapshots upsert dedups logically; this UNIQUE index enforces it at
    // the DB, so a concurrent double-submit can't slip a second row past the
    // by-(accountId, date) filter (#109 chunk 8). Migrated in place — see
    // ensureUniqueSnapshotIndex.
    ensureUniqueSnapshotIndex(db),
    // FIRE assumptions (#110 chunk 3). Exactly one document per household — the
    // singleton the get/upsert path targets with an empty (household-scoped)
    // filter — so `householdId` is the unique key, backstopping a concurrent
    // double-save from creating a second row past the by-household upsert filter.
    db.collection(COLLECTIONS.fireAssumptions).createIndex({ householdId: 1 }, { unique: true }),
    // Target-suggestion dismissals (#186 chunk 3). At most one row per
    // (household, category) — the dismiss upsert targets it by categoryId, so
    // the composite is unique. Its `householdId` prefix also serves the
    // household-only list read. A fresh collection, so a plain unique create (no
    // migration from a prior non-unique form).
    db
      .collection(COLLECTIONS.targetSuggestionDismissals)
      .createIndex({ householdId: 1, categoryId: 1 }, { unique: true }),
    // Auth collections (#111 chunk 2). A user has exactly one identity record
    // and at most one membership in v1, so both lookups are unique. Invites
    // are listed per household (matching is in-app via `matchInvite`).
    db
      .collection(COLLECTIONS.users)
      .createIndex({ providerSubjectId: 1 }, { unique: true }),
    db.collection(COLLECTIONS.members).createIndex({ userId: 1 }, { unique: true }),
    // Per-household member listing for the owner's Members panel (#111 chunk 6).
    db.collection(COLLECTIONS.members).createIndex({ householdId: 1 }),
    db.collection(COLLECTIONS.invites).createIndex({ householdId: 1 }),
    // At most one *pending* invite per (household, email) — the owner UI checks
    // first, this is the race backstop (#111 chunk 6). Partial so accepted
    // invites (history) don't collide and a re-invite after acceptance is fine.
    // Emails are stored normalized (see `parseInviteEmail`), so the equality the
    // index dedupes on is the same one `matchInvite` compares.
    db
      .collection(COLLECTIONS.invites)
      .createIndex(
        { householdId: 1, email: 1 },
        { unique: true, partialFilterExpression: { status: "pending" } },
      ),
  ]).then(() => undefined);
}

/**
 * Ensure the snapshots `(householdId, accountId, date)` index is **unique**,
 * migrating in place from the non-unique form chunk 2 shipped. Only drops the
 * index when it exists *and* isn't already unique — so a DB that never had it
 * (fresh prod) just creates the unique one, and one already migrated skips the
 * drop, avoiding an index rebuild on every cold start (a plain drop-then-create
 * of the same key would churn, unlike the differently-keyed migrations above).
 */
async function ensureUniqueSnapshotIndex(db: Db): Promise<void> {
  const snapshots = db.collection(COLLECTIONS.snapshots);
  const name = "householdId_1_accountId_1_date_1";
  const existing = (await snapshots
    .indexes()
    .catch(() => [])) as { name?: string; unique?: boolean }[];
  const current = existing.find((index) => index.name === name);
  if (current && !current.unique) {
    await snapshots.dropIndex(name).catch((err: { code?: number }) => {
      if (err?.code !== 27) throw err; // 27 = IndexNotFound (already gone)
    });
  }
  await snapshots.createIndex({ householdId: 1, accountId: 1, date: 1 }, { unique: true });
}
