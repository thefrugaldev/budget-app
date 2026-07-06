import { randomUUID } from "crypto";

import { requireHouseholdId } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { COLLECTIONS } from "@/lib/db/collections";
import type { CategoryDocument } from "@/lib/db/documents";
import { toCategory } from "@/lib/db/mappers";
import type { Category } from "@/types/budget";

export async function listCategories(): Promise<Category[]> {
  const householdId = await requireHouseholdId();
  const db = await getDb();

  const docs = await db
    .collection<CategoryDocument>(COLLECTIONS.categories)
    .find({ householdId })
    .sort({ name: 1 })
    .toArray();

  return docs.map(toCategory);
}

export async function createCategory(input: {
  name: string;
  // Legacy display glyph. New categories store `icon` and pass "" here; kept
  // for back-compat with the resolver's emoji fallback.
  emoji?: string;
  icon?: string;
  kind: Category["kind"];
  activeFrom: string;
  activeUntil?: string;
  incomeFrequency?: Category["incomeFrequency"];
  payCadence?: Category["payCadence"];
  firstPaycheckDate?: string;
}): Promise<Category> {
  const householdId = await requireHouseholdId();
  const db = await getDb();

  const doc: CategoryDocument = {
    _id: randomUUID(),
    householdId,
    name: input.name,
    kind: input.kind,
    activeFrom: input.activeFrom,
    createdAt: new Date(),
    // Only set optional fields when actually provided. Writing `undefined`
    // makes Mongo persist `null`, which then leaks through readers as
    // truthy-undefined and trips checks like `activeUntil !== undefined`.
    // New categories are icon-based and omit `emoji` entirely (rather than
    // storing ""), so `if (category.emoji)` stays honest for consumers.
    ...(input.emoji !== undefined ? { emoji: input.emoji } : {}),
    ...(input.icon !== undefined ? { icon: input.icon } : {}),
    ...(input.activeUntil !== undefined ? { activeUntil: input.activeUntil } : {}),
    ...(input.incomeFrequency !== undefined
      ? { incomeFrequency: input.incomeFrequency }
      : {}),
    ...(input.payCadence !== undefined ? { payCadence: input.payCadence } : {}),
    ...(input.firstPaycheckDate !== undefined
      ? { firstPaycheckDate: input.firstPaycheckDate }
      : {}),
  };

  await db.collection<CategoryDocument>(COLLECTIONS.categories).insertOne(doc);
  return toCategory(doc);
}

type CategoryPatch = {
  name?: string;
  emoji?: string;
  icon?: string;
  kind?: Category["kind"];
  activeFrom?: string;
  activeUntil?: string;
  incomeFrequency?: Category["incomeFrequency"];
  payCadence?: Category["payCadence"];
  firstPaycheckDate?: string;
  /** `true` clears the field via `$unset`; falsy leaves it alone. */
  clearActiveUntil?: boolean;
  /**
   * Clears `payCadence` via `$unset` — e.g. switching a source to one-time, or
   * a recurring source back to cadence-unset. Falsy leaves it alone.
   */
  clearPayCadence?: boolean;
  /**
   * Clears `firstPaycheckDate` via `$unset` — e.g. the user blanks the anchor,
   * or it's dropped when switching to one-time. Falsy leaves it alone.
   */
  clearFirstPaycheckDate?: boolean;
};

// Keys on CategoryPatch that drive `$unset` rather than `$set`.
const CLEAR_FLAGS = new Set([
  "clearActiveUntil",
  "clearPayCadence",
  "clearFirstPaycheckDate",
]);

// Returns true if a matching category was found and patched.
export async function updateCategory(
  id: string,
  patch: CategoryPatch,
): Promise<boolean> {
  const set: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(patch)) {
    if (CLEAR_FLAGS.has(key)) continue;
    if (value !== undefined) set[key] = value;
  }

  const unset: Record<string, "" | true> = {};
  if (patch.clearActiveUntil) unset.activeUntil = "";
  if (patch.clearPayCadence) unset.payCadence = "";
  if (patch.clearFirstPaycheckDate) unset.firstPaycheckDate = "";

  if (Object.keys(set).length === 0 && Object.keys(unset).length === 0) {
    return false;
  }

  const update: Record<string, unknown> = {};
  if (Object.keys(set).length > 0) update.$set = set;
  if (Object.keys(unset).length > 0) update.$unset = unset;

  const householdId = await requireHouseholdId();
  const db = await getDb();
  const result = await db
    .collection<CategoryDocument>(COLLECTIONS.categories)
    .updateOne({ _id: id, householdId }, update);
  return result.matchedCount > 0;
}

// Hard delete: removes the category. Callers must ensure that no transactions
// reference it and target rows are handled separately (the server action
// composes the full cleanup).
export async function deleteCategory(id: string): Promise<boolean> {
  const householdId = await requireHouseholdId();
  const db = await getDb();
  const result = await db
    .collection<CategoryDocument>(COLLECTIONS.categories)
    .deleteOne({ _id: id, householdId });
  return result.deletedCount > 0;
}

export async function getCategoriesByIds(
  ids: string[],
): Promise<Map<string, Category>> {
  if (ids.length === 0) {
    return new Map();
  }

  const householdId = await requireHouseholdId();
  const db = await getDb();
  const docs = await db
    .collection<CategoryDocument>(COLLECTIONS.categories)
    .find({ _id: { $in: ids }, householdId })
    .toArray();

  return new Map(docs.map((doc) => [doc._id, toCategory(doc)]));
}

export async function getCategoryById(id: string): Promise<Category | undefined> {
  const householdId = await requireHouseholdId();
  const db = await getDb();
  const doc = await db
    .collection<CategoryDocument>(COLLECTIONS.categories)
    .findOne({ _id: id, householdId });
  return doc ? toCategory(doc) : undefined;
}
