import { randomUUID } from "crypto";

import { getDb } from "@/lib/db/client";
import { COLLECTIONS } from "@/lib/db/collections";
import type { CategoryTargetDocument } from "@/lib/db/documents";
import { ensureIndexes } from "@/lib/db/indexes";
import { toCategoryTarget } from "@/lib/db/mappers";
import type { CategoryTarget } from "@/types/budget";

export async function listCategoryTargets(): Promise<CategoryTarget[]> {
  const db = await getDb();
  await ensureIndexes(db);

  const docs = await db
    .collection<CategoryTargetDocument>(COLLECTIONS.categoryTargets)
    .find()
    .sort({ categoryId: 1, effectiveFrom: 1 })
    .toArray();

  return docs.map(toCategoryTarget);
}

export async function listCategoryTargetsFor(
  categoryId: string,
): Promise<CategoryTarget[]> {
  const db = await getDb();
  await ensureIndexes(db);

  const docs = await db
    .collection<CategoryTargetDocument>(COLLECTIONS.categoryTargets)
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
  const db = await getDb();
  await ensureIndexes(db);

  const doc: CategoryTargetDocument = {
    _id: randomUUID(),
    categoryId: input.categoryId,
    monthly: input.monthly,
    effectiveFrom: input.effectiveFrom,
    createdAt: new Date(),
  };

  await db
    .collection<CategoryTargetDocument>(COLLECTIONS.categoryTargets)
    .insertOne(doc);

  return toCategoryTarget(doc);
}

export async function updateCategoryTarget(
  categoryId: string,
  effectiveFrom: string,
  monthly: number,
): Promise<void> {
  const db = await getDb();
  await db
    .collection<CategoryTargetDocument>(COLLECTIONS.categoryTargets)
    .updateOne({ categoryId, effectiveFrom }, { $set: { monthly } });
}

export async function deleteCategoryTarget(
  categoryId: string,
  effectiveFrom: string,
): Promise<void> {
  const db = await getDb();
  await db
    .collection<CategoryTargetDocument>(COLLECTIONS.categoryTargets)
    .deleteOne({ categoryId, effectiveFrom });
}
