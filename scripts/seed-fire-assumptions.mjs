// FIRE assumptions seeder (#110 chunk 5 — to *see* the projection chart fully).
//
// The FIRE chart's recorded segment reads the same snapshots the net-worth
// trajectory does, so `seed:networth` already back-dates the history it needs.
// What it can't infer is the one assumption with no default: your **birth year**
// — and without it the chart withholds the coast line, the age axis, and the
// FIRE-date marker (honest degradation, story 19). This seeds a persisted
// assumption set (birth year + a spend/contribution/rate scenario) so every part
// of the projection renders for visual testing and auditing.
//
// It upserts the single household document the app's repository owns
// (`fireAssumptions`, keyed by householdId), exactly as the Save action would —
// so the seeded scenario is indistinguishable from one entered in the UI, and
// the page's Reset-to-defaults clears it. Runs need no live prices.
//
// Usage (point it at whichever DB you want to see it in — pull the preview env
// first, e.g. `vercel env pull .env.preview`):
//   node --env-file=.env.preview scripts/seed-fire-assumptions.mjs           # default scenario
//   node --env-file=.env.preview scripts/seed-fire-assumptions.mjs 1985      # override birth year
//   node --env-file=.env.preview scripts/seed-fire-assumptions.mjs clear     # remove the seeded set
//
// Env: MONGODB_URI (required), MONGODB_DB_NAME (default "budget"),
//      NW_HOUSEHOLD_ID (optional — otherwise inferred from the accounts present).

import { randomUUID } from "crypto";

import { MongoClient } from "mongodb";

const URI = process.env.MONGODB_URI;
if (!URI) {
  console.error("Missing MONGODB_URI (run with `node --env-file=.env.preview ...`).");
  process.exit(1);
}
const DB_NAME = process.env.MONGODB_DB_NAME ?? "budget";
const HOUSEHOLD_OVERRIDE = process.env.NW_HOUSEHOLD_ID;

// A plausible mid-career scenario. Spend/contribution are monthly, today's
// dollars; the three rate knobs are percentages. Birth year is overridable via
// argv[1] so you can eyeball the age axis and coast horizon at different ages.
// Leaving spend/contribution here (rather than tracking the data-derived
// defaults) makes the seeded scenario reproducible regardless of the budget data
// present, which is what you want for a visual reference.
const DEFAULT_BIRTH_YEAR = 1988;
const scenario = (birthYear) => ({
  monthlyRetirementSpend: 5000,
  monthlyContribution: 2500,
  nominalReturn: 7,
  inflation: 3,
  safeWithdrawalRate: 4,
  birthYear,
  traditionalRetirementAge: 65,
});

async function main() {
  const arg = process.argv[2];
  const clearing = arg === "clear";
  const birthYear = arg && !clearing ? Number(arg) : DEFAULT_BIRTH_YEAR;
  const thisYear = new Date().getUTCFullYear();
  if (!clearing && (!Number.isInteger(birthYear) || birthYear < 1900 || birthYear > thisYear)) {
    console.error(`Invalid birth year: ${arg} (expected 1900–${thisYear}).`);
    process.exit(1);
  }

  const client = new MongoClient(URI);
  await client.connect();
  const db = client.db(DB_NAME);
  const accountsCol = db.collection("accounts");
  const assumptionsCol = db.collection("fireAssumptions");

  // Infer the household from the accounts present (single-household in v1), or
  // take the override. Refuse to guess if several households have accounts.
  let householdId = HOUSEHOLD_OVERRIDE;
  if (!householdId) {
    const ids = (await accountsCol.distinct("householdId")).filter(Boolean);
    if (ids.length === 0) {
      console.error(`No accounts in "${DB_NAME}". Create accounts (and one check-in) first.`);
      process.exit(1);
    }
    if (ids.length > 1) {
      console.error(`Multiple households have accounts: ${ids.join(", ")}. Set NW_HOUSEHOLD_ID.`);
      process.exit(1);
    }
    householdId = ids[0];
  }

  if (clearing) {
    const res = await assumptionsCol.deleteOne({ householdId });
    console.log(
      res.deletedCount
        ? `Cleared the seeded FIRE assumptions for household ${householdId} in "${DB_NAME}".`
        : `No FIRE assumptions to clear for household ${householdId}.`,
    );
    await client.close();
    return;
  }

  const set = { ...scenario(birthYear), householdId, updatedAt: new Date() };
  await assumptionsCol.updateOne(
    { householdId },
    { $set: set, $setOnInsert: { _id: randomUUID() } },
    { upsert: true },
  );
  console.log(
    `Seeded FIRE assumptions for household ${householdId} in "${DB_NAME}": ` +
      `spend $${set.monthlyRetirementSpend}/mo, contribution $${set.monthlyContribution}/mo, ` +
      `${set.nominalReturn}%/${set.inflation}%/${set.safeWithdrawalRate}%, born ${birthYear}.`,
  );
  console.log("Reload /fire — the projection shows the coast line, age axis, and FIRE-date marker.");
  await client.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
