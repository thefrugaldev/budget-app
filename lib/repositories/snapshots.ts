import { randomUUID } from "crypto";

import { COLLECTIONS } from "@/lib/db/collections";
import type { SnapshotDocument } from "@/lib/db/documents";
import { scopedCollection } from "@/lib/db/household-scope";
import { toSnapshot } from "@/lib/db/mappers";
import { assertNonNegativeSnapshotValue } from "@/lib/net-worth/validate";
import type { Snapshot } from "@/types/net-worth";

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
 * write boundary. Used by `closeAccount` (the final `value: 0` snapshot); the
 * check-in write path (chunk 5) records the full set at once.
 */
export async function createSnapshot(input: {
  accountId: string;
  date: string;
  value: number;
}): Promise<Snapshot> {
  assertNonNegativeSnapshotValue(input.value);
  const snapshots = await scopedCollection<SnapshotDocument>(COLLECTIONS.snapshots);
  const doc: SnapshotDocument = {
    _id: randomUUID(),
    accountId: input.accountId,
    date: input.date,
    value: input.value,
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
