import "server-only";

import type { Document } from "mongodb";

import { requireHouseholdId } from "@/lib/auth/session";

import { getDb } from "./client";
import { ScopedCollection } from "./scoped-collection";

/**
 * Open a household-scoped handle to `name` (#121). Resolves the request's
 * household once — via the `cache()`-wrapped session, so many calls in one
 * request cost a single resolution — and binds it to the collection.
 *
 * This is the *only* way household-owned repositories reach Mongo: they never
 * call `getDb()`/`.collection()` directly, so the household filter can't be
 * silently omitted (enforced by `household-scope.guard.test.ts`). It inherits
 * `requireHouseholdId`'s guarantee — a non-active session throws and reaches no
 * data (#111 story 14), server-side on every read and write.
 */
export async function scopedCollection<
  T extends { householdId?: string } & Document,
>(name: string): Promise<ScopedCollection<T>> {
  const householdId = await requireHouseholdId();
  const db = await getDb();
  return new ScopedCollection<T>(db.collection<T>(name), householdId);
}
