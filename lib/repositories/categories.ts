import { randomUUID } from "crypto";

import { getDb } from "@/lib/db/client";
import { COLLECTIONS } from "@/lib/db/collections";
import type { CategoryDocument } from "@/lib/db/documents";
import { ensureIndexes } from "@/lib/db/indexes";
import { toCategory } from "@/lib/db/mappers";
import type { Category } from "@/types/budget";

export async function listCategories(): Promise<Category[]> {
  const db = await getDb();
  await ensureIndexes(db);

  const docs = await db
    .collection<CategoryDocument>(COLLECTIONS.categories)
    .find()
    .sort({ name: 1 })
    .toArray();

  return docs.map(toCategory);
}

export async function createCategory(input: {
  name: string;
  emoji: string;
  kind: Category["kind"];
  activeFrom: string;
  activeUntil?: string;
}): Promise<Category> {
  const db = await getDb();
  await ensureIndexes(db);

  const doc: CategoryDocument = {
    _id: randomUUID(),
    name: input.name,
    emoji: input.emoji,
    kind: input.kind,
    activeFrom: input.activeFrom,
    activeUntil: input.activeUntil,
    createdAt: new Date(),
  };

  await db.collection<CategoryDocument>(COLLECTIONS.categories).insertOne(doc);
  return toCategory(doc);
}

type CategoryPatch = {
  name?: string;
  emoji?: string;
  activeFrom?: string;
  activeUntil?: string;
};

// Returns true if a matching category was found and patched.
export async function updateCategory(
  id: string,
  patch: CategoryPatch,
): Promise<boolean> {
  const set: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(patch)) {
    if (value !== undefined) set[key] = value;
  }
  if (Object.keys(set).length === 0) return false;

  const db = await getDb();
  const result = await db
    .collection<CategoryDocument>(COLLECTIONS.categories)
    .updateOne({ _id: id }, { $set: set });
  return result.matchedCount > 0;
}

export async function getCategoriesByIds(
  ids: string[],
): Promise<Map<string, Category>> {
  if (ids.length === 0) {
    return new Map();
  }

  const db = await getDb();
  const docs = await db
    .collection<CategoryDocument>(COLLECTIONS.categories)
    .find({ _id: { $in: ids } })
    .toArray();

  return new Map(docs.map((doc) => [doc._id, toCategory(doc)]));
}
