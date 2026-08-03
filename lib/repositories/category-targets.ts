import { randomUUID } from "crypto";

import { COLLECTIONS } from "@/lib/db/collections";
import type { CategoryTargetDocument } from "@/lib/db/documents";
import { scopedCollection } from "@/lib/db/household-scope";
import { toCategoryTarget } from "@/lib/db/mappers";
import type { CategoryTarget } from "@/types/budget";

export async function listCategoryTargets(): Promise<CategoryTarget[]> {
  const targets = await scopedCollection<CategoryTargetDocument>(
    COLLECTIONS.categoryTargets,
  );

  const docs = await targets
    .find()
    .sort({ categoryId: 1, effectiveFrom: 1 })
    .toArray();

  return docs.map(toCategoryTarget);
}

export async function listCategoryTargetsFor(
  categoryId: string,
): Promise<CategoryTarget[]> {
  const targets = await scopedCollection<CategoryTargetDocument>(
    COLLECTIONS.categoryTargets,
  );

  const docs = await targets
    .find({ categoryId })
    .sort({ effectiveFrom: 1 })
    .toArray();

  return docs.map(toCategoryTarget);
}

export async function createCategoryTarget(input: {
  categoryId: string;
  monthly: number;
  effectiveFrom: string;
}): Promise<CategoryTarget> {
  const targets = await scopedCollection<CategoryTargetDocument>(
    COLLECTIONS.categoryTargets,
  );

  const doc: CategoryTargetDocument = {
    _id: randomUUID(),
    categoryId: input.categoryId,
    monthly: input.monthly,
    effectiveFrom: input.effectiveFrom,
    createdAt: new Date(),
  };

  await targets.insertOne(doc);

  return toCategoryTarget(doc);
}

/**
 * Idempotent at `(categoryId, effectiveFrom)`: updates the `monthly` value if a
 * row already exists for that key (so a user can "Apply this month" twice and
 * have the second value win), otherwise inserts a new row. Used by the income
 * edit modal where the caller picks `effectiveFrom` based on an "apply this
 * month" toggle.
 */
export async function upsertCategoryTarget(input: {
  categoryId: string;
  monthly: number;
  effectiveFrom: string;
}): Promise<void> {
  const targets = await scopedCollection<CategoryTargetDocument>(
    COLLECTIONS.categoryTargets,
  );

  await targets.updateOne(
    { categoryId: input.categoryId, effectiveFrom: input.effectiveFrom },
    {
      $set: { monthly: input.monthly },
      // Only the fields NOT in the filter: on an upsert-insert Mongo copies the
      // equality-match filter fields (categoryId, effectiveFrom, and the
      // householdId the scoped collection merges in) into the new document, so
      // listing them here too would be redundant.
      $setOnInsert: {
        _id: randomUUID(),
        createdAt: new Date(),
      },
    },
    { upsert: true },
  );
}

export async function updateCategoryTarget(
  categoryId: string,
  effectiveFrom: string,
  monthly: number,
): Promise<void> {
  const targets = await scopedCollection<CategoryTargetDocument>(
    COLLECTIONS.categoryTargets,
  );
  await targets.updateOne({ categoryId, effectiveFrom }, { $set: { monthly } });
}

export async function deleteCategoryTarget(
  categoryId: string,
  effectiveFrom: string,
): Promise<void> {
  const targets = await scopedCollection<CategoryTargetDocument>(
    COLLECTIONS.categoryTargets,
  );
  await targets.deleteOne({ categoryId, effectiveFrom });
}

// Wipes every target row for `categoryId`. Used by the category hard-delete
// path so the orphaned rows don't linger.
export async function deleteAllCategoryTargets(categoryId: string): Promise<void> {
  const targets = await scopedCollection<CategoryTargetDocument>(
    COLLECTIONS.categoryTargets,
  );
  await targets.deleteMany({ categoryId });
}
