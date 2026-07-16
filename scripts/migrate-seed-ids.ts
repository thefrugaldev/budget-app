/**
 * One-off migration: rewrite legacy colon-namespaced seed `_id`s
 * (`${householdId}:${baseId}`) to the current colon-free 32-char SHA-256 hex
 * scheme (see `lib/db/seed-data.ts` → `seedDocId`).
 *
 * Why: a `:` in a category `_id` doesn't round-trip through the App Router's
 * client-side `<Link>` navigation, so `/categories/[id]` 404'd for every seeded
 * category on preview/local (prod, colon-free from the Excel import, was never
 * affected). This aligns seeded data with prod's id shape.
 *
 * The new id of any old colon id is exactly `sha256(oldColonId).slice(0,32)`,
 * because the old id was literally `${householdId}:${baseId}` and the new
 * `seedDocId(householdId, baseId)` hashes that same string. So this migration
 * needs no knowledge of slugs — it hashes whatever colon ids it finds, and
 * rewrites both the docs' own `_id`s and every `categoryId` reference to them
 * (including user-created transactions pointing at a seed category).
 *
 * Safe to run repeatedly (idempotent): only ids containing a `:` are touched,
 * and current-scheme ids (hex, no colon) are left alone. Randomly-generated
 * user ids (`randomUUID`, dashed) never contain a colon, so user docs' own
 * `_id`s are untouched — only their references to migrated categories move.
 *
 * Usage (env supplies MONGODB_URI / MONGODB_DB_NAME):
 *   set -a; . ./.env.preview; set +a
 *   pnpm exec tsx scripts/migrate-seed-ids.ts          # dry run (default)
 *   pnpm exec tsx scripts/migrate-seed-ids.ts --apply  # perform the writes
 */
import { createHash } from "node:crypto";

import { MongoClient } from "mongodb";

import { seedDocId } from "../lib/db/seed-data";

const APPLY = process.argv.includes("--apply");

const SEED_COLLECTIONS = ["categories", "categoryTargets", "transactions"] as const;

// Our documents key on a string `_id` (hashed / colon-namespaced / randomUUID),
// never a Mongo ObjectId — type the collections accordingly so string-id filters
// typecheck.
type MigDoc = { _id: string; categoryId?: string; [key: string]: unknown };

/** New id for a legacy colon id: hash the full old string (see file header). */
function newIdFor(oldColonId: string): string {
  return createHash("sha256").update(oldColonId).digest("hex").slice(0, 32);
}

function assertSchemeMatches(): void {
  // Guard that this script's `newIdFor` matches the app's `seedDocId` exactly,
  // so a migrated DB is byte-identical to what a fresh seed would write. If
  // `seedDocId` ever changes shape, this fails loudly instead of silently
  // producing ids the app won't recognise.
  const hh = "example-household";
  const expected = seedDocId(hh, "groceries");
  const viaMigration = newIdFor(`${hh}:groceries`);
  if (expected !== viaMigration) {
    throw new Error(
      `Scheme drift: seedDocId=${expected} migration=${viaMigration}. ` +
        "Update newIdFor to match lib/db/seed-data.ts.",
    );
  }
}

async function main(): Promise<void> {
  assertSchemeMatches();

  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DB_NAME;
  if (!uri || !dbName) {
    throw new Error("MONGODB_URI and MONGODB_DB_NAME must be set in the env.");
  }

  console.log(
    `${APPLY ? "APPLYING" : "DRY RUN"} — db "${dbName}" ` +
      `(${uri.replace(/\/\/[^@]*@/, "//[creds]@")})\n`,
  );

  const client = new MongoClient(uri);
  await client.connect();
  try {
    const db = client.db(dbName);

    // Phase 1 — rewrite `categoryId` references (colon → hashed). Covers every
    // doc that points at a category, seed or user-created.
    for (const name of ["categoryTargets", "transactions"] as const) {
      const coll = db.collection<MigDoc>(name);
      const refs = await coll
        .find({ categoryId: { $regex: ":" } }, { projection: { _id: 1, categoryId: 1 } })
        .toArray();
      console.log(`[${name}] categoryId refs to remap: ${refs.length}`);
      for (const doc of refs) {
        const oldRef = doc.categoryId as string;
        const newRef = newIdFor(oldRef);
        if (APPLY) {
          await coll.updateOne({ _id: doc._id }, { $set: { categoryId: newRef } });
        } else if (refs.indexOf(doc) < 3) {
          console.log(`    ${oldRef}  →  ${newRef}`);
        }
      }
    }

    // Phase 2 — rewrite the docs' own colon `_id`s (immutable, so copy+delete).
    for (const name of SEED_COLLECTIONS) {
      const coll = db.collection<MigDoc>(name);
      const docs = await coll.find({ _id: { $regex: ":" } }).toArray();
      console.log(`[${name}] docs with colon _id to remap: ${docs.length}`);
      for (const doc of docs) {
        const oldId = doc._id as unknown as string;
        const newId = newIdFor(oldId);
        if (!APPLY) {
          if (docs.indexOf(doc) < 3) console.log(`    ${oldId}  →  ${newId}`);
          continue;
        }
        const rest = { ...doc };
        delete (rest as { _id?: string })._id;
        // Upsert the new-id doc (no-op if a prior run already created it), then
        // drop the old-id doc — idempotent across partial runs. `_id: newId`
        // trails the spread so it's the effective primary key.
        await coll.updateOne(
          { _id: newId },
          { $setOnInsert: { ...rest, _id: newId } },
          { upsert: true },
        );
        await coll.deleteOne({ _id: oldId });
      }
    }

    console.log(`\n${APPLY ? "Done." : "Dry run complete — re-run with --apply to write."}`);
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
