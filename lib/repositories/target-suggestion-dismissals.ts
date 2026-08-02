import { randomUUID } from "crypto";

import { COLLECTIONS } from "@/lib/db/collections";
import type { TargetSuggestionDismissalDocument } from "@/lib/db/documents";
import { scopedCollection } from "@/lib/db/household-scope";
import { toTargetSuggestionDismissal } from "@/lib/db/mappers";
import type { TargetSuggestionDismissal } from "@/types/target-suggestion";

/**
 * Persistence for Target-suggestion **dismissals** (#186 chunk 3, ADR 0006) —
 * the only stored state of the suggestions feature. One row per (household,
 * category): dismissing a suggestion upserts the row with the level it was
 * declined at, the detector reads them back to honor the snooze, and accepting
 * a suggestion deletes any stale row. Suggestions themselves are never
 * persisted — they're derived on read by `selectTargetSuggestions`.
 */

/** Every dismissal for the household, for the detector's snooze check. */
export async function listTargetSuggestionDismissals(): Promise<TargetSuggestionDismissal[]> {
  const dismissals = await scopedCollection<TargetSuggestionDismissalDocument>(
    COLLECTIONS.targetSuggestionDismissals,
  );
  const docs = await dismissals.find().toArray();
  return docs.map(toTargetSuggestionDismissal);
}

/**
 * Record (or refresh) the dismissal for a category, stamping `dismissedAt` now.
 * Idempotent at (household, categoryId): re-dismissing overwrites the captured
 * level rather than inserting a second row. The upsert filter is the full unique
 * key — `categoryId` here plus the `householdId` the scoped wrapper merges in —
 * so it matches the `(householdId, categoryId)` unique index and can't create a
 * duplicate.
 */
export async function upsertTargetSuggestionDismissal(input: {
  categoryId: string;
  dismissedMedian: number;
  dismissedAgainstTarget: number;
}): Promise<void> {
  const dismissals = await scopedCollection<TargetSuggestionDismissalDocument>(
    COLLECTIONS.targetSuggestionDismissals,
  );

  await dismissals.updateOne(
    { categoryId: input.categoryId },
    {
      $set: {
        dismissedMedian: input.dismissedMedian,
        dismissedAgainstTarget: input.dismissedAgainstTarget,
        dismissedAt: new Date(),
      },
      // Only the fields not in the filter: on an upsert-insert Mongo copies the
      // match fields (categoryId + the scoped householdId) into the new doc.
      $setOnInsert: { _id: randomUUID() },
    },
    { upsert: true },
  );
}

/**
 * Remove a category's dismissal. Used when a suggestion is accepted (the record
 * is now stale) and by the category hard-delete cleanup. Idempotent — deleting
 * a category with no dismissal is a no-op.
 */
export async function deleteTargetSuggestionDismissal(categoryId: string): Promise<void> {
  const dismissals = await scopedCollection<TargetSuggestionDismissalDocument>(
    COLLECTIONS.targetSuggestionDismissals,
  );
  await dismissals.deleteOne({ categoryId });
}
