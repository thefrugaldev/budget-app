/**
 * Predicates over Mongo driver errors, shared so a refinement (e.g. matching a
 * `MongoServerError` subclass, or the `WriteError` shape a Cosmos Mongo API
 * surfaces) happens in one place. Deliberately structural — we duck-type the
 * `code` rather than `instanceof`-checking a driver class, so this stays correct
 * across driver versions and Atlas/Cosmos backends.
 */

/**
 * True for a duplicate-key violation (unique/partial-unique index). Callers use
 * it to turn a lost write race into their own domain outcome: the first-sign-in
 * bootstrap adopts the winner's records; the invite action reports "already has
 * a pending invite" instead of a 500.
 */
export function isDuplicateKeyError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    (err as { code?: number }).code === 11000
  );
}
