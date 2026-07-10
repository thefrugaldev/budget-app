import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

/**
 * Enforcement for #121: household-owned data modules must reach Mongo ONLY
 * through `scopedCollection`, never a raw `getDb()`/`.collection()`. That's what
 * makes "forgot to scope by household" unrepresentable rather than a filter each
 * repo has to remember (the silent-omission risk `tsc`/lint can't catch, since a
 * query missing `householdId` still type-checks).
 *
 * When a new household-owned collection lands (e.g. the NW/FIRE repos), add its
 * module here. Deliberately NOT listed: `lib/db/seed.ts` (takes an explicit
 * household id and stamps it — kept off the session/Clerk import chain so its
 * pure helpers stay unit-testable) and `lib/db/backfill.ts` (the pre-household
 * bootstrap adopt path). Those opt out visibly, in one reviewed file each.
 */
const HOUSEHOLD_SCOPED_MODULES = [
  "./categories.ts",
  "./categoryTargets.ts",
  "./transactions.ts",
  "./monthly-spend.ts",
  "./accounts.ts",
  "./snapshots.ts",
  "../db/reset.ts",
];

function read(rel: string): string {
  return readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");
}

describe("household scoping is enforced at the data seam (#121)", () => {
  for (const rel of HOUSEHOLD_SCOPED_MODULES) {
    it(`${rel} reaches Mongo only via scopedCollection`, () => {
      const src = read(rel);
      expect(src, `${rel} must not call getDb()`).not.toMatch(/\bgetDb\b/);
      expect(src, `${rel} must not open a raw .collection()`).not.toMatch(
        /\.collection\s*\(/,
      );
      expect(src, `${rel} must import scopedCollection`).toMatch(
        /scopedCollection/,
      );
    });
  }
});
