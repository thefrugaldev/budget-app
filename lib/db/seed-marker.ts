// Auto-seed-disabled marker ids — pure, dependency-free helpers.
//
// Split out of `seed.ts` (which pulls the `getDb` → `next/server` chain) so
// non-Next callers can reach them: the archive `apply` CLI (#118) writes this
// marker as part of the first prod apply, and it must import without dragging
// the Next request runtime. `seed.ts` re-exports both for its existing callers.

/**
 * Base `meta` doc key recording that a household explicitly cleared its data
 * (danger-zone reset, #81 story 9). While the marker is present, auto-seed never
 * runs again for that household, so a deliberately-emptied budget stays empty
 * across cold starts / new serverless instances.
 *
 * Retained as the *legacy* key: a pre-auth reset wrote a bare `"autoSeedDisabled"`
 * marker that the bootstrap backfill later stamped with a `householdId`. New
 * markers use the per-household id below; both are honored on read.
 */
export const AUTO_SEED_DISABLED_ID = "autoSeedDisabled";

/**
 * The per-household auto-seed-disabled marker `_id`. Embedding the household in
 * the `_id` (rather than a bare shared key + a `householdId` field) keeps the
 * primary key unique across the tenancy boundary, so a second household — or the
 * same owner re-bootstrapping a new household after a chunk-6 delete-household —
 * can record its own reset without dup-keying on a shared marker id (#120 review).
 */
export function autoSeedDisabledId(householdId: string): string {
  return `${AUTO_SEED_DISABLED_ID}:${householdId}`;
}
