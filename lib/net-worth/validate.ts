import type { AccountClass, AssetKind } from "@/types/net-worth";

/**
 * Guard the account shape at the write boundary (#109 chunk 2; carried over from
 * the chunk-1 review). An asset must carry a `kind`; a liability must not. This
 * stops a malformed asset (`class: "asset"`, `kind: undefined`) from silently
 * falling through {@link accountValue} to a cash-like manual balance, and keeps
 * a liability from sprouting an investment kind. Pure, so it's unit-tested
 * without the DB and reused by every repository write path that shapes an
 * account.
 */
export function assertValidAccountShape(input: {
  class: AccountClass;
  kind?: AssetKind;
}): void {
  if (input.class === "asset" && input.kind === undefined) {
    throw new Error("An asset account must have a kind (cash, investment, or property).");
  }
  if (input.class === "liability" && input.kind !== undefined) {
    throw new Error(
      "A liability account must not have a kind — liabilities are always manual-balance.",
    );
  }
}

/**
 * Snapshot values are **magnitudes**: the account's `class` supplies the sign in
 * aggregation, so a stored negative would silently flip a liability's
 * contribution to net worth. Reject negatives (and non-finite values) at the
 * write boundary (#109 chunk 2; carried over from the chunk-1 review).
 */
export function assertNonNegativeSnapshotValue(value: number): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`A snapshot value must be a non-negative magnitude (got ${value}).`);
  }
}
