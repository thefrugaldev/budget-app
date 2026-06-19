// Performance fixture seeder for issue #17 chunk 6 (virtualisation gate).
//
// Generates a large, realistic transaction set so the transaction list's
// render/scroll performance can be measured against story 28 ("thousands of
// rows should not lock the browser"). Writes to an ISOLATED database
// (`budget-perf` by default) so the normal dev data is never touched.
//
// Usage:
//   node --env-file=.env.local scripts/seed-perf-fixture.mjs [count]   # seed (default 2000)
//   node --env-file=.env.local scripts/seed-perf-fixture.mjs drop      # tear the perf DB down
//
// The DB name is fixed to PERF_DB_NAME (default "budget-perf") regardless of
// MONGODB_DB_NAME, so pointing the app at it for a measurement is opt-in:
//   MONGODB_DB_NAME=budget-perf pnpm dev

import { MongoClient } from "mongodb";

const DB_NAME = process.env.PERF_DB_NAME ?? "budget-perf";
const URI = process.env.MONGODB_URI;
if (!URI) {
  console.error("Missing MONGODB_URI (run with `node --env-file=.env.local ...`).");
  process.exit(1);
}

const ACTIVE_FROM = "2026-01";

// Mirror of the dev seed's categories so the perf DB renders the same UI.
const CATEGORIES = [
  { _id: "groceries", name: "Groceries", emoji: "🛒", kind: "expense", initialMonthly: 800 },
  { _id: "dining", name: "Dining out", emoji: "🍔", kind: "expense", initialMonthly: 300 },
  { _id: "gas", name: "Gas", emoji: "⛽", kind: "expense", initialMonthly: 180 },
  { _id: "utilities", name: "Utilities", emoji: "💡", kind: "expense", initialMonthly: 220 },
  { _id: "rent", name: "Rent", emoji: "🏠", kind: "expense", initialMonthly: 2200 },
  { _id: "entertainment", name: "Entertainment", emoji: "🎬", kind: "expense", initialMonthly: 150 },
  { _id: "shopping", name: "Shopping", emoji: "🛍️", kind: "expense", initialMonthly: 200 },
  { _id: "travel", name: "Travel", emoji: "✈️", kind: "expense", initialMonthly: 250 },
  { _id: "hysa", name: "HYSA", emoji: "🏦", kind: "savings", initialMonthly: 800 },
  { _id: "brokerage", name: "Brokerage", emoji: "📈", kind: "savings", initialMonthly: 600 },
  { _id: "vacation", name: "Vacation fund", emoji: "🏖️", kind: "savings", initialMonthly: 200 },
  { _id: "salary", name: "Salary", emoji: "💼", kind: "income", initialMonthly: 7500 },
];

const VENDORS = {
  groceries: ["Whole Foods", "Trader Joe's", "Costco", "Safeway", "Kroger"],
  dining: ["Tacos El Gordo", "Sushi Ran", "Nopa", "Chipotle", "Blue Bottle"],
  gas: ["Shell", "Chevron", "Kroger Fuel", "76"],
  utilities: ["PG&E", "Comcast", "AT&T"],
  rent: ["Greystar"],
  entertainment: ["AMC Theatres", "Spotify", "Netflix", "Steam"],
  shopping: ["Amazon", "Uniqlo", "Nike", "Target"],
  travel: ["United", "Airbnb", "Delta", "Marriott"],
  hysa: ["Ally Bank"],
  brokerage: ["Vanguard", "Fidelity"],
  vacation: ["Marcus"],
  salary: ["Acme Corp"],
};

const NOTES = [
  "weekly haul",
  "produce, salmon, olive oil",
  "dinner party",
  "Bought Apples, Grapes, Meat, Seafood, Milk, Cereal, Bread, Tomatoes and a lot of other produce",
  "Returned 🍌",
  "bulk run",
  "Italy trip",
  "Tahoe weekend",
  "Winter peak",
  "mid-month transfer",
];

// Deterministic PRNG (mulberry32) so repeated runs produce comparable data.
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
const rand = mulberry32(20260618);
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const int = (min, max) => min + Math.floor(rand() * (max - min + 1));
const money = (min, max) => Math.round((min + rand() * (max - min)) * 100) / 100;

// 12-month window ending in the current seed month (matches the app's
// "last 12 months" range). Past months use all 28 days; the current month
// caps at day 18 so no transaction is dated in the future.
const MONTHS = [
  "2025-07", "2025-08", "2025-09", "2025-10", "2025-11", "2025-12",
  "2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06",
];

function randomDate() {
  const month = pick(MONTHS);
  const maxDay = month === "2026-06" ? 18 : 28;
  return `${month}-${String(int(1, maxDay)).padStart(2, "0")}`;
}

function generateTransactions(count) {
  const docs = [];
  const now = new Date();
  let i = 0;
  while (docs.length < count) {
    const cat = pick(CATEGORIES);
    const vendor = pick(VENDORS[cat._id]);
    const date = randomDate();
    // ~20% of the time emit a same-vendor-same-day run (2–5 rows) so the
    // streak-collapse path is exercised at scale.
    const runLength = rand() < 0.2 ? int(2, 5) : 1;
    for (let r = 0; r < runLength && docs.length < count; r++) {
      const refund = rand() < 0.05;
      const base =
        cat._id === "rent"
          ? 2200
          : cat.kind === "income"
            ? money(500, 4000)
            : money(8, 450);
      docs.push({
        _id: `perf-${i++}`,
        categoryId: cat._id,
        amount: refund ? -money(5, 80) : base,
        date,
        vendor,
        note: rand() < 0.3 ? pick(NOTES) : undefined,
        createdAt: now,
      });
    }
  }
  return docs;
}

async function main() {
  const arg = process.argv[2];
  const client = new MongoClient(URI);
  await client.connect();
  const db = client.db(DB_NAME);

  if (arg === "drop") {
    await db.dropDatabase();
    console.log(`Dropped database "${DB_NAME}".`);
    await client.close();
    return;
  }

  const count = arg ? Number(arg) : 2000;
  if (!Number.isFinite(count) || count <= 0) {
    console.error(`Invalid count: ${arg}`);
    process.exit(1);
  }

  const now = new Date();
  // Reset the three collections for a repeatable fixture (safe — isolated DB).
  await Promise.all([
    db.collection("categories").deleteMany({}),
    db.collection("categoryTargets").deleteMany({}),
    db.collection("transactions").deleteMany({}),
  ]);

  await db.collection("categories").insertMany(
    CATEGORIES.map((c) => ({
      _id: c._id,
      name: c.name,
      emoji: c.emoji,
      kind: c.kind,
      activeFrom: ACTIVE_FROM,
      createdAt: now,
    })),
  );
  await db.collection("categoryTargets").insertMany(
    CATEGORIES.map((c) => ({
      _id: `${c._id}:${ACTIVE_FROM}`,
      categoryId: c._id,
      monthly: c.initialMonthly,
      effectiveFrom: ACTIVE_FROM,
      createdAt: now,
    })),
  );

  const txns = generateTransactions(count);
  await db.collection("transactions").insertMany(txns);

  const days = new Set(txns.map((t) => t.date)).size;
  console.log(
    `Seeded "${DB_NAME}": ${txns.length} transactions across ${days} days, ` +
      `${CATEGORIES.length} categories.`,
  );
  await client.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
