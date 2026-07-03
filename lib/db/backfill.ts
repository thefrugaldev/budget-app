import { planBackfill } from "@/lib/auth";
import type { BackfillableDoc, BackfillPlan } from "@/types/auth";

import { getDb } from "./client";
import { COLLECTIONS } from "./collections";

// Minimal typed view of any user-data collection for the backfill: string `_id`
// (all our docs use string ids) plus the optional ownership stamp. Typing the
// dynamic-name collection keeps the driver from inferring an ObjectId `_id`.
type OwnedDoc = { _id: string; householdId?: string };

/**
 * The user-data collections a bootstrap adopts into the new household (ADR 0004,
 * story 3). Matches the reset list plus `meta` — the auto-seed marker is stamped
 * so it survives chunk 4's household-scoped reads. The quote cache (a future
 * collection) is intentionally absent: a price is app-global, not household data
 * (story 16). When a new user-data collection lands (NW/FIRE), add it here.
 */
const BACKFILL_COLLECTIONS = [
  COLLECTIONS.categories,
  COLLECTIONS.categoryTargets,
  COLLECTIONS.transactions,
  COLLECTIONS.meta,
] as const;

/**
 * Backfill write path for the first-sign-in bootstrap (wired in chunk 3): stamp
 * `householdId` onto every pre-auth document that lacks one, adopting years of
 * existing budget history into the newly-created household.
 *
 * The pure `planBackfill` (chunk 1) decides *which* ids to stamp — read here
 * over `_id`/`householdId` projections only (cheap, no full documents), mapped
 * `_id → id` at this repository seam since domain planning speaks `id`. The
 * write is then a thin `updateMany` per collection. Idempotent: already-stamped
 * docs are skipped by the planner, so a re-run (partial or repeated bootstrap)
 * never re-stamps and never hijacks a doc owned by another household. Returns
 * the plan for observability.
 */
export async function runBackfill(householdId: string): Promise<BackfillPlan> {
  const db = await getDb();

  const collections: Record<string, BackfillableDoc[]> = {};
  for (const name of BACKFILL_COLLECTIONS) {
    const docs = await db
      .collection<OwnedDoc>(name)
      .find({}, { projection: { _id: 1, householdId: 1 } })
      .toArray();
    collections[name] = docs.map((doc) => ({
      id: doc._id,
      householdId: doc.householdId,
    }));
  }

  const plan = planBackfill(householdId, collections);

  for (const [name, ids] of Object.entries(plan.byCollection)) {
    if (ids.length === 0) continue;
    await db
      .collection<OwnedDoc>(name)
      .updateMany({ _id: { $in: ids } }, { $set: { householdId } });
  }

  return plan;
}
