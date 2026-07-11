import type { Db } from "mongodb";
import { describe, expect, it, vi } from "vitest";

/**
 * Guards the load-bearing invariant introduced when `ensureIndexes` moved onto
 * `getDb`'s critical path (#115): a failed index build must reset the memo so
 * the next call retries, rather than poisoning every future DB access with the
 * same rejected promise. A refactor that drops the `= undefined` reset would
 * pass every other test — so this one exists to catch exactly that.
 *
 * `vi.resetModules()` + dynamic import gives each test a fresh module-level
 * memo, so the tests don't leak `indexesReady` state into one another.
 */

// A Db test double whose only observable behavior is index creation: it counts
// build attempts and can be told to fail the current attempt. `dropIndex` and
// `indexes` always resolve trivially (empty index list → the snapshot migration
// takes its create-only path; the real drop's only concern is the absent code).
function mockDb(opts: { failWhile: () => boolean; onCreate?: () => void }): Db {
  const collection = () => ({
    dropIndex: () => Promise.resolve(),
    indexes: () => Promise.resolve([]),
    createIndex: () => {
      opts.onCreate?.();
      return opts.failWhile()
        ? Promise.reject(new Error("transient index build failure"))
        : Promise.resolve("ok");
    },
  });
  return { collection } as unknown as Db;
}

describe("ensureIndexes", () => {
  it("resets its memo on failure so the next call retries the build", async () => {
    vi.resetModules();
    const { ensureIndexes } = await import("./indexes");

    let failing = true;
    const db = mockDb({ failWhile: () => failing });

    await expect(ensureIndexes(db)).rejects.toThrow(
      "transient index build failure",
    );

    failing = false;
    await expect(ensureIndexes(db)).resolves.toBeUndefined();
  });

  it("builds once and memoizes on success", async () => {
    vi.resetModules();
    const { ensureIndexes } = await import("./indexes");

    let creates = 0;
    const db = mockDb({ failWhile: () => false, onCreate: () => (creates += 1) });

    await ensureIndexes(db);
    const afterFirst = creates;
    expect(afterFirst).toBeGreaterThan(0);

    await ensureIndexes(db);
    expect(creates).toBe(afterFirst); // second call resolves from the memo
  });
});
