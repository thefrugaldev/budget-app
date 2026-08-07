// Demo history reseeder (#160 — to *see* the year selector + scope-driven chart).
//
// The seed dataset now spans 2024–2026 (see `lib/db/seed-data.ts`), but an
// already-seeded database only auto-*backfills* missing categories on boot — it
// never adds the new historical transactions or backdates the existing
// categories' `activeFrom`. This script brings a preview/dev DB up to the
// current dataset by rebuilding this household's demo docs from scratch.
//
// It rebuilds ONLY `source: "seed"` docs, so hand-entered and imported history
// are untouched — but it is still preview/dev-only: never point it at a
// production database where seed categories may have been adopted as real data.
// Two guards enforce that: it refuses to write without DEMO_SEED_CONFIRM=1 and
// prints the target database name up front.
//
// Usage (pull the preview env first, e.g. `vercel env pull .env.preview`):
//   DEMO_SEED_CONFIRM=1 pnpm exec tsx --env-file=.env.preview scripts/seed-demo-history.ts
//   pnpm exec tsx --env-file=.env.preview scripts/seed-demo-history.ts clear   # remove seed docs
//
// Env: MONGODB_URI (required), MONGODB_DB_NAME (default "budget"),
//      DEMO_HOUSEHOLD_ID (optional — otherwise inferred from the seed docs present),
//      DEMO_SEED_CONFIRM=1 (required to write; omitted for `clear`).

import { COLLECTIONS } from "@/lib/db/collections";
import type {
  CategoryDocument,
  CategoryTargetDocument,
  TransactionDocument,
} from "@/lib/db/documents";
import {
  buildCategoryDoc,
  buildTargetDoc,
  buildTransactionDoc,
  SEED_ACTIVE_FROM,
  SEED_CATEGORIES,
  SEED_TRANSACTIONS,
} from "@/lib/db/seed-data";

import { connectMongo, runCli } from "./import-sheets/cli";

async function main(): Promise<number> {
  const clear = process.argv.includes("clear");
  const householdOverride = process.env.DEMO_HOUSEHOLD_ID;

  const { client, db } = await connectMongo();
  try {
    console.log(`Target database: "${db.databaseName}".`);
    const categories = db.collection<CategoryDocument>(COLLECTIONS.categories);
    const targets = db.collection<CategoryTargetDocument>(COLLECTIONS.categoryTargets);
    const transactions = db.collection<TransactionDocument>(COLLECTIONS.transactions);

    // Resolve the demo household from the seed docs already present (single
    // household in v1), or take the override for a fresh DB with none yet.
    let householdId = householdOverride;
    if (!householdId) {
      const ids = (
        await categories.distinct("householdId", { source: "seed" })
      ).filter((id): id is string => typeof id === "string" && id.length > 0);
      if (ids.length === 0) {
        console.error(
          'No source:"seed" categories found — set DEMO_HOUSEHOLD_ID to target a specific household.',
        );
        return 1;
      }
      if (ids.length > 1) {
        console.error(`Multiple seed households: ${ids.join(", ")}. Set DEMO_HOUSEHOLD_ID.`);
        return 1;
      }
      householdId = ids[0];
    }
    console.log(`Household: ${householdId}.`);

    const wipe = () =>
      Promise.all([
        transactions.deleteMany({ householdId, source: "seed" }),
        categories.deleteMany({ householdId, source: "seed" }),
        targets.deleteMany({ householdId, source: "seed" }),
      ]);

    if (clear) {
      const [t, c, g] = await wipe();
      console.log(
        `Cleared seed docs — ${t.deletedCount} transactions, ${c.deletedCount} categories, ${g.deletedCount} targets.`,
      );
      return 0;
    }

    if (process.env.DEMO_SEED_CONFIRM !== "1") {
      console.error(
        'Refusing to write without DEMO_SEED_CONFIRM=1. This rebuilds every source:"seed" doc for the household — run against preview/dev databases only, never production.',
      );
      return 1;
    }

    const now = new Date();
    await wipe();

    const categoryDocs = SEED_CATEGORIES.map((c) => buildCategoryDoc(c, householdId, now));
    const targetDocs = SEED_CATEGORIES.map((c) => buildTargetDoc(c, householdId, now)).filter(
      (d): d is CategoryTargetDocument => d !== undefined,
    );
    const transactionDocs = SEED_TRANSACTIONS.map((t) =>
      buildTransactionDoc(t, householdId, now),
    );

    await categories.insertMany(categoryDocs);
    await targets.insertMany(targetDocs);
    await transactions.insertMany(transactionDocs);

    console.log(
      `Reseeded ${categoryDocs.length} categories, ${targetDocs.length} targets, ` +
        `${transactionDocs.length} transactions (active from ${SEED_ACTIVE_FROM}).`,
    );
    console.log("Reload Pulse — the year selector now offers past years and the chart follows the scope.");
    return 0;
  } finally {
    await client.close();
  }
}

runCli(import.meta.url, "seed-demo-history", main);
