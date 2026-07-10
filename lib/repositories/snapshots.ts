import { randomUUID } from "crypto";

import { COLLECTIONS } from "@/lib/db/collections";
import type { SnapshotDocument } from "@/lib/db/documents";
import { scopedCollection } from "@/lib/db/household-scope";
import { toSnapshot } from "@/lib/db/mappers";
import { assertNonNegativeSnapshotValue, assertValidIsoDate } from "@/lib/net-worth/validate";
import type { Snapshot, SnapshotComposition } from "@/types/net-worth";

/** Every recorded snapshot for the household, in date order — feeds the history series. */
export async function listSnapshots(): Promise<Snapshot[]> {
  const snapshots = await scopedCollection<SnapshotDocument>(COLLECTIONS.snapshots);
  const docs = await snapshots.find().sort({ date: 1 }).toArray();
  return docs.map(toSnapshot);
}

/** One account's snapshots, in date order. */
export async function listSnapshotsForAccount(accountId: string): Promise<Snapshot[]> {
  const snapshots = await scopedCollection<SnapshotDocument>(COLLECTIONS.snapshots);
  const docs = await snapshots.find({ accountId }).sort({ date: 1 }).toArray();
  return docs.map(toSnapshot);
}

/**
 * Record a single valuation snapshot. `value` is a non-negative magnitude —
 * the account's class supplies the sign in aggregation — enforced here at the
 * write boundary. The optional `composition` (chunk 5) persists what the value
 * was made of at record time (resolved holdings/prices or the manual balance);
 * `closeAccount`'s final `value: 0` snapshot passes none. Used by both that
 * close path and the check-in write path, which records the full set at once.
 */
export async function createSnapshot(input: {
  accountId: string;
  date: string;
  value: number;
  composition?: SnapshotComposition;
}): Promise<Snapshot> {
  assertValidIsoDate(input.date);
  assertNonNegativeSnapshotValue(input.value);
  const snapshots = await scopedCollection<SnapshotDocument>(COLLECTIONS.snapshots);
  const doc: SnapshotDocument = {
    _id: randomUUID(),
    accountId: input.accountId,
    date: input.date,
    value: input.value,
    // Written only when provided, so the close snapshot stays composition-free
    // and a leaked `null` never reaches a reader — same discipline as the
    // optional account fields (see createAccount).
    ...(input.composition !== undefined ? { composition: input.composition } : {}),
    createdAt: new Date(),
  };
  await snapshots.insertOne(doc);
  return toSnapshot(doc);
}

/** How many snapshots an account has — the "is this account empty?" test for hard-delete. */
export async function countSnapshotsForAccount(accountId: string): Promise<number> {
  const snapshots = await scopedCollection<SnapshotDocument>(COLLECTIONS.snapshots);
  return snapshots.countDocuments({ accountId });
}

/** Remove all of an account's snapshots. Returns the number deleted. */
export async function deleteSnapshotsForAccount(accountId: string): Promise<number> {
  const snapshots = await scopedCollection<SnapshotDocument>(COLLECTIONS.snapshots);
  const result = await snapshots.deleteMany({ accountId });
  return result.deletedCount ?? 0;
}
