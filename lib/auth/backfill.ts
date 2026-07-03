import type { BackfillableDoc, BackfillPlan } from "@/types/auth";

/**
 * Plan the bootstrap backfill: which documents, per collection, still lack a
 * `householdId` and must be stamped with the newly-created household's id
 * (story 3). Pure over document sets so it's testable without a database; the
 * caller (chunk 2) turns each collection's id list into one bulk write.
 *
 * Idempotent and safe to re-run: a document that already carries *any*
 * `householdId` is left alone, so a partial or repeated backfill never
 * re-stamps and a doc belonging to another household is never hijacked. Every
 * collection passed in appears in the plan (empty list when nothing to stamp),
 * so the caller sees the full picture.
 */
export function planBackfill(
  householdId: string,
  collections: Record<string, readonly BackfillableDoc[]>,
): BackfillPlan {
  const byCollection: Record<string, string[]> = {};
  let total = 0;

  for (const [collection, docs] of Object.entries(collections)) {
    const ids = docs.filter((doc) => doc.householdId == null).map((d) => d.id);
    byCollection[collection] = ids;
    total += ids.length;
  }

  return { householdId, byCollection, total };
}
