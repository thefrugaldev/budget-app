import { randomUUID } from "crypto";
import type { UpdateFilter } from "mongodb";

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
 * Record a single valuation snapshot (used by `closeAccount`'s final `value: 0`
 * write). Day-grain upsert via {@link createSnapshots}, so closing on a day the
 * account was already recorded replaces that day rather than duplicating it.
 */
export async function createSnapshot(input: {
  accountId: string;
  date: string;
  value: number;
  composition?: SnapshotComposition;
}): Promise<Snapshot> {
  await createSnapshots([input]);
  return { accountId: input.accountId, date: input.date, value: input.value };
}

/**
 * Record a check-in's snapshots — one per open account, **day-grain** (#109
 * chunk 5/8). Each is upserted on `(accountId, date)` within the household, so
 * re-recording the same day *replaces* that day's snapshot while distinct days
 * accrue. That keeps the full retained history the trajectory derives its one
 * monthly point from (latest on/before month-end), without churn from a
 * double-submit — recording updates the *live* account values elsewhere; this
 * is purely the history write (ADR 0003). Every input is validated before any
 * write. Returns the number of accounts recorded.
 */
export async function createSnapshots(
  inputs: {
    accountId: string;
    date: string;
    value: number;
    composition?: SnapshotComposition;
  }[],
): Promise<number> {
  if (inputs.length === 0) return 0;
  for (const input of inputs) {
    assertValidIsoDate(input.date);
    assertNonNegativeSnapshotValue(input.value);
  }
  const snapshots = await scopedCollection<SnapshotDocument>(COLLECTIONS.snapshots);
  const now = new Date();
  for (const input of inputs) {
    const update: UpdateFilter<SnapshotDocument> = {
      $set:
        input.composition !== undefined
          ? { value: input.value, composition: input.composition }
          : { value: input.value },
      $setOnInsert: { _id: randomUUID(), createdAt: now },
      // A re-record that drops the composition (e.g. a close's zero snapshot
      // landing over an earlier record) clears the stale one rather than
      // leaving it attached to a now-different value.
      ...(input.composition === undefined ? { $unset: { composition: "" } } : {}),
    };
    await snapshots.updateOne({ accountId: input.accountId, date: input.date }, update, {
      upsert: true,
    });
  }
  return inputs.length;
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
