import { requireHouseholdId } from "@/lib/auth/session";

import { COLLECTIONS } from "./collections";
import type {
  CategoryDocument,
  CategoryTargetDocument,
  MetaDocument,
  TransactionDocument,
} from "./documents";
import { scopedCollection } from "./household-scope";
import { resetDeletionFilter } from "./reset-filter";
import { autoSeedDisabledId } from "./seed";

/**
 * Danger-zone reset (#81 story 9): permanently clears user-data collections
 * (transactions, categories, and their target history) and records the
 * auto-seed-disabled marker so {@link ensureSeeded} never refills the
 * deliberately-emptied database on a later cold start. Local data only — there
 * is no remote/account state to touch yet.
 *
 * By default it spares imported archive history (#118 story 14): only
 * hand-entered docs are removed. `includeImported: true` (the explicit UI
 * opt-in) clears the imported docs too.
 *
 * The marker is written **first, on purpose**: MongoDB has no cross-collection
 * transaction guarantee here, so a delete could partially fail. By disabling
 * auto-seed up front, any outcome — full wipe, partial wipe, or total delete
 * failure — is safe: the app never re-inserts seed categories that could
 * collide with survivors. It is also written **regardless of
 * `includeImported`**: any press of the danger-zone button is a signal not to
 * auto-refill demo data, independent of whether imported history is spared. A marker on a still-populated DB (all deletes failed)
 * is inert, since a non-empty DB is never auto-seeded anyway, and the caller
 * surfaces the error so the reset can be retried. `clearedAt` is recorded for
 * observability only — nothing reads it today.
 *
 * NB: when a new user-data collection is added, clear it here too.
 */
export async function resetAllData(
  options: { includeImported?: boolean } = {},
): Promise<void> {
  const includeImported = options.includeImported ?? false;

  // Needed for the marker's per-household `_id`; the scoped collections resolve
  // the same (cached) household internally for their own filters and stamps.
  const householdId = await requireHouseholdId();

  const [meta, transactions, categories, targets] = await Promise.all([
    scopedCollection<MetaDocument>(COLLECTIONS.meta),
    scopedCollection<TransactionDocument>(COLLECTIONS.transactions),
    scopedCollection<CategoryDocument>(COLLECTIONS.categories),
    scopedCollection<CategoryTargetDocument>(COLLECTIONS.categoryTargets),
  ]);

  // Per-household marker id, so two households (or a re-bootstrap after a
  // delete-household) never dup-key on a shared `_id`. The scoped collection
  // merges `householdId` into the filter, so the upsert-insert stamps it —
  // only the mutable `clearedAt` needs `$set`.
  await meta.updateOne(
    { _id: autoSeedDisabledId(householdId) },
    { $set: { clearedAt: new Date() } },
    { upsert: true },
  );

  // Only this household's data — the scoped deleteMany can't reach another's —
  // and, by default, only its non-imported docs (imported history is spared).
  await Promise.all([
    transactions.deleteMany(resetDeletionFilter<TransactionDocument>(includeImported)),
    categories.deleteMany(resetDeletionFilter<CategoryDocument>(includeImported)),
    targets.deleteMany(resetDeletionFilter<CategoryTargetDocument>(includeImported)),
  ]);
}
