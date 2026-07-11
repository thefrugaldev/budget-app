// Net-worth history seeder (#109 chunk 9 — to *see* the trajectory chart).
//
// The chart needs several recorded months to draw a line; a fresh setup only
// has this month's check-in. This back-dates synthetic monthly snapshots for
// each open account so the trajectory renders as a real trend. It anchors on
// each account's LATEST existing snapshot value — the value your real check-in
// already recorded — so it needs no live prices and works for every account
// kind. Prior months ramp toward that anchor: asset magnitudes are smaller in
// the past, liability magnitudes larger (debt paid down since), so net worth
// trends upward. A little deterministic jitter keeps the line from being a
// perfectly straight ramp.
//
// It writes ONLY to prior months (dates strictly before the current month), so
// it never touches your real current-month snapshot. Upserts on the day-grain
// key (householdId, accountId, date), matching the app's unique index.
//
// Usage (point it at whichever DB you want to see it in — pull the preview env
// first, e.g. `vercel env pull .env.preview`):
//   node --env-file=.env.preview scripts/seed-net-worth-history.mjs [months]   # default 6
//   node --env-file=.env.preview scripts/seed-net-worth-history.mjs clear      # remove seeded months
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

// Current calendar month as "YYYY-MM" (UTC — dates are stored as plain ISO days).
const now = new Date();
const CURRENT_YM = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;

// The last calendar day of a "YYYY-MM" (day 0 of the next month), as "YYYY-MM-DD".
function monthEndDate(ym) {
  const [y, m] = ym.split("-").map(Number);
  const day = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${ym}-${String(day).padStart(2, "0")}`;
}

// The `count` months immediately BEFORE the current month, oldest first.
function priorMonths(count) {
  const [y, m] = CURRENT_YM.split("-").map(Number);
  const out = [];
  for (let back = count; back >= 1; back--) {
    const d = new Date(Date.UTC(y, m - 1 - back, 1));
    out.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
  }
  return out;
}

// Deterministic PRNG (mulberry32) so repeated runs produce the same series.
function mulberry32(seed) {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

async function main() {
  const arg = process.argv[2];
  const months = arg && arg !== "clear" ? Number(arg) : 6;
  if (arg && arg !== "clear" && (!Number.isFinite(months) || months <= 0)) {
    console.error(`Invalid months: ${arg}`);
    process.exit(1);
  }

  const client = new MongoClient(URI);
  await client.connect();
  const db = client.db(DB_NAME);
  const accountsCol = db.collection("accounts");
  const snapshotsCol = db.collection("snapshots");

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

  const target = priorMonths(months);

  if (arg === "clear") {
    const res = await snapshotsCol.deleteMany({
      householdId,
      date: { $in: target.map(monthEndDate) },
    });
    console.log(`Cleared ${res.deletedCount} seeded snapshot(s) from "${DB_NAME}" (${target[0]}…${target[target.length - 1]}).`);
    await client.close();
    return;
  }

  const openAccounts = await accountsCol.find({ householdId, closedAt: { $exists: false } }).toArray();
  if (openAccounts.length === 0) {
    console.error(`No open accounts for household ${householdId}.`);
    process.exit(1);
  }

  const ops = [];
  let anchored = 0;
  for (const account of openAccounts) {
    // Anchor on the account's most recent recorded value (your real check-in).
    const latest = await snapshotsCol
      .find({ householdId, accountId: account._id })
      .sort({ date: -1 })
      .limit(1)
      .toArray();
    if (latest.length === 0) continue; // never checked in — nothing to anchor on
    anchored++;

    const anchor = latest[0].value; // non-negative magnitude
    const rand = mulberry32(hashSeed(account._id));
    const isLiability = account.class === "liability";

    target.forEach((ym, i) => {
      // 0 (oldest) → 1 (this month). Assets grew ~18% over the window; a
      // liability magnitude was ~12% larger in the past (paid down since).
      const t = (i + 1) / (target.length + 1);
      const trend = isLiability ? 1 + 0.12 * (1 - t) : 0.82 + 0.18 * t;
      const jitter = 1 + (rand() - 0.5) * 0.03; // ±1.5%
      const value = Math.max(0, Math.round(anchor * trend * jitter * 100) / 100);
      const date = monthEndDate(ym);

      ops.push({
        updateOne: {
          filter: { householdId, accountId: account._id, date },
          update: {
            $set: { value },
            $setOnInsert: { _id: randomUUID(), householdId, accountId: account._id, date, createdAt: now },
          },
          upsert: true,
        },
      });
    });
  }

  if (ops.length === 0) {
    console.error("No accounts had an existing snapshot to anchor on — record a check-in first.");
    process.exit(1);
  }

  const res = await snapshotsCol.bulkWrite(ops, { ordered: false });
  const written = (res.upsertedCount ?? 0) + (res.modifiedCount ?? 0);
  console.log(
    `Seeded ${written} snapshot(s) across ${target.length} months ` +
      `(${target[0]}…${target[target.length - 1]}) for ${anchored} account(s) in household ${householdId}.`,
  );
  console.log("Reload /net-worth — the trajectory now spans multiple months.");
  await client.close();
}

// Stable per-account seed so each account's jitter is deterministic across runs.
function hashSeed(id) {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
