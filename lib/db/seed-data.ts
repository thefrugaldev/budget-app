// The demo-seed dataset and its id scheme — pure, dependency-free (type-only
// imports). Split out of `seed.ts` (which pulls the `getDb` → `next/server`
// chain) following the `seed-marker` precedent. `seed.ts` consumes these to
// insert the demo data; new seed docs are stamped `source: "seed"` (#163) so
// they're identifiable by provenance rather than by matching this content.

import { createHash } from "node:crypto";

import type {
  CategoryDocument,
  CategoryTargetDocument,
  TransactionDocument,
} from "./documents";

/**
 * Deterministic, colon-free `_id` for a seed doc, namespaced by household.
 *
 * The seed dataset uses stable, human-readable base ids (`"groceries"`, `"t1"`,
 * a target's `` `${slug}:${effectiveFrom}` ``) that are shared across the
 * codebase and, by design, identical for every household. This hashes
 * `` `${householdId}:${baseId}` `` into a 32-char SHA-256 hex — the **exact**
 * scheme prod uses (`scripts/import-sheets/import-ref.ts` → `hashImportRef`) —
 * so seeded dev/preview ids match prod's shape. The hash keeps each household's
 * copy of a shared base id unique across the tenancy boundary (#120), and is
 * stable so re-seeding never duplicates.
 *
 * Why not the old `` `${householdId}:${baseId}` `` string form: a `:` in a
 * category `_id` doesn't round-trip through the App Router's client-side
 * `<Link>` navigation, so `/categories/[id]` 404'd for every seeded category on
 * preview (prod, colon-free, was unaffected). Colon-free ids remove that class
 * of bug entirely.
 *
 * NB: databases seeded before this scheme (bare ids pre-#111; colon ids
 * pre-this-change) hold legacy `_id`s; `ensureSeeded`'s backfill recognizes
 * both legacy forms so it never re-inserts them as duplicates.
 */
export function seedDocId(householdId: string, id: string): string {
  return createHash("sha256")
    .update(`${householdId}:${id}`)
    .digest("hex")
    .slice(0, 32);
}

// The seed categories go active two full years before the hand-authored recent
// months so the year selector (#160) has complete past years to offer and the
// scope-driven Growth Columns have real history to plot. Kept as a "YYYY-MM" so
// the target `effectiveFrom` and category `activeFrom` share one anchor.
export const SEED_ACTIVE_FROM = "2024-01";

export type SeedCategory = Omit<CategoryDocument, "createdAt"> & {
  // Omitted for one-time income sources, which have no baseline target — their
  // story is received transactions, not a monthly figure (#46).
  initialMonthly?: number;
};

export const SEED_CATEGORIES: SeedCategory[] = [
  { _id: "groceries", name: "Groceries", emoji: "🛒", kind: "expense", activeFrom: SEED_ACTIVE_FROM, initialMonthly: 800 },
  { _id: "dining", name: "Dining out", emoji: "🍔", kind: "expense", activeFrom: SEED_ACTIVE_FROM, initialMonthly: 300 },
  { _id: "gas", name: "Gas", emoji: "⛽", kind: "expense", activeFrom: SEED_ACTIVE_FROM, initialMonthly: 180 },
  { _id: "utilities", name: "Utilities", emoji: "💡", kind: "expense", activeFrom: SEED_ACTIVE_FROM, initialMonthly: 220 },
  { _id: "rent", name: "Rent", emoji: "🏠", kind: "expense", activeFrom: SEED_ACTIVE_FROM, initialMonthly: 2200 },
  { _id: "entertainment", name: "Entertainment", emoji: "🎬", kind: "expense", activeFrom: SEED_ACTIVE_FROM, initialMonthly: 150 },
  { _id: "shopping", name: "Shopping", emoji: "🛍️", kind: "expense", activeFrom: SEED_ACTIVE_FROM, initialMonthly: 200 },
  { _id: "travel", name: "Travel", emoji: "✈️", kind: "expense", activeFrom: SEED_ACTIVE_FROM, initialMonthly: 250 },
  { _id: "hysa", name: "HYSA", emoji: "🏦", kind: "savings", activeFrom: SEED_ACTIVE_FROM, initialMonthly: 800 },
  { _id: "brokerage", name: "Brokerage", emoji: "📈", kind: "savings", activeFrom: SEED_ACTIVE_FROM, initialMonthly: 600 },
  { _id: "vacation", name: "Vacation fund", emoji: "🏖️", kind: "savings", activeFrom: SEED_ACTIVE_FROM, initialMonthly: 200 },
  { _id: "salary", name: "Salary", emoji: "💼", kind: "income", activeFrom: SEED_ACTIVE_FROM, initialMonthly: 7500, incomeFrequency: "recurring", payCadence: "bi-weekly" },
  // One-time source (#46): no baseline target; its receipts are the RSU vest
  // transactions below, so the fresh install showcases both income kinds.
  { _id: "rsu", name: "RSU vests", emoji: "📊", kind: "income", activeFrom: SEED_ACTIVE_FROM, incomeFrequency: "one-time" },
];

export type SeedTransaction = Omit<TransactionDocument, "createdAt">;

// Two full prior years (2024–2025) of history so past-year scopes aren't empty:
// the recurring bills + transfers every month, a couple of RSU vests and a
// vacation contribution a year. Generated deterministically — a small wobble
// keyed off the month, no RNG — so re-seeding is stable and the id scheme
// (`h-YYYY-MM-<slug>`) never collides with the hand-authored `t*` recent months.
function historicalTransactions(): SeedTransaction[] {
  const out: SeedTransaction[] = [];
  for (const year of [2024, 2025]) {
    for (let m = 1; m <= 12; m++) {
      const ym = `${year}-${String(m).padStart(2, "0")}`;
      const wobble = ((m * 7 + year) % 5) - 2; // deterministic -2..2
      const id = (slug: string) => `h-${ym}-${slug}`;
      out.push(
        { _id: id("rent"), categoryId: "rent", amount: 2200, date: `${ym}-01`, vendor: "Greystar" },
        { _id: id("utilities"), categoryId: "utilities", amount: 200 + wobble * 8, date: `${ym}-01`, vendor: "PG&E" },
        { _id: id("groceries"), categoryId: "groceries", amount: 620 + wobble * 15, date: `${ym}-08`, vendor: "Various" },
        { _id: id("dining"), categoryId: "dining", amount: 240 + wobble * 12, date: `${ym}-14`, vendor: "Various" },
        { _id: id("gas"), categoryId: "gas", amount: 160 + wobble * 6, date: `${ym}-20`, vendor: "Various" },
        { _id: id("hysa"), categoryId: "hysa", amount: 800, date: `${ym}-15`, vendor: "Ally Bank" },
        { _id: id("brokerage"), categoryId: "brokerage", amount: 600, date: `${ym}-02`, vendor: "Vanguard" },
      );
    }
    // Chunkier, lower-frequency contributions so the savings canopy has shape.
    out.push(
      { _id: `h-${year}-03-rsu`, categoryId: "rsu", amount: 12000, date: `${year}-03-15`, vendor: "Morgan Stanley", note: "Q1 vest" },
      { _id: `h-${year}-09-rsu`, categoryId: "rsu", amount: 12000, date: `${year}-09-15`, vendor: "Morgan Stanley", note: "Q3 vest" },
      { _id: `h-${year}-07-vacation`, categoryId: "vacation", amount: 200, date: `${year}-07-10`, vendor: "Marcus", note: "Summer fund" },
    );
  }
  return out;
}

// Hand-authored recent months (2026) — the detailed, varied slice a fresh
// install lands on. Composed after the generated history below.
const RECENT_TRANSACTIONS: SeedTransaction[] = [
  { _id: "t1", categoryId: "groceries", amount: 87.42, date: "2026-06-04", vendor: "Whole Foods", note: "produce, salmon, olive oil" },
  { _id: "t2", categoryId: "dining", amount: 24.5, date: "2026-06-04", vendor: "Tacos El Gordo" },
  { _id: "t3", categoryId: "gas", amount: 52.18, date: "2026-06-03", vendor: "Shell" },
  { _id: "t4", categoryId: "hysa", amount: 400, date: "2026-06-02", vendor: "Ally Bank", note: "Mid-month transfer" },
  { _id: "t5", categoryId: "groceries", amount: 64.11, date: "2026-06-02", vendor: "Trader Joe's", note: "snacks, frozen meals" },
  { _id: "t6", categoryId: "rent", amount: 2200, date: "2026-06-01", vendor: "Greystar" },
  { _id: "t7", categoryId: "utilities", amount: 142.33, date: "2026-06-01", vendor: "PG&E" },
  { _id: "t8", categoryId: "brokerage", amount: 300, date: "2026-06-01", vendor: "Vanguard" },
  { _id: "t9", categoryId: "groceries", amount: 92.5, date: "2026-05-29", vendor: "Whole Foods", note: "weekly haul" },
  { _id: "t10", categoryId: "dining", amount: 48.0, date: "2026-05-28", vendor: "Sushi Ran" },
  { _id: "t11", categoryId: "entertainment", amount: 35.0, date: "2026-05-27", vendor: "AMC Theatres" },
  { _id: "t12", categoryId: "shopping", amount: 220, date: "2026-05-24", vendor: "Uniqlo", note: "summer shirts" },
  { _id: "t13", categoryId: "groceries", amount: 78.3, date: "2026-05-22", vendor: "Trader Joe's" },
  { _id: "t14", categoryId: "gas", amount: 48.99, date: "2026-05-20", vendor: "Chevron" },
  { _id: "t15", categoryId: "hysa", amount: 800, date: "2026-05-15", vendor: "Ally Bank" },
  { _id: "t16", categoryId: "groceries", amount: 105.2, date: "2026-05-14", vendor: "Whole Foods", note: "dinner party" },
  { _id: "t17", categoryId: "dining", amount: 88.4, date: "2026-05-12", vendor: "Nopa" },
  { _id: "t18", categoryId: "vacation", amount: 250, date: "2026-05-10", vendor: "Marcus", note: "Italy trip" },
  { _id: "t19", categoryId: "rent", amount: 2200, date: "2026-05-01", vendor: "Greystar" },
  { _id: "t20", categoryId: "utilities", amount: 188.4, date: "2026-05-01", vendor: "PG&E" },
  { _id: "t21", categoryId: "brokerage", amount: 600, date: "2026-05-01", vendor: "Vanguard" },
  { _id: "t22", categoryId: "travel", amount: 412, date: "2026-05-03", vendor: "United", note: "SFO → SEA" },
  { _id: "t23", categoryId: "groceries", amount: 410, date: "2026-04-28", vendor: "Costco", note: "bulk run" },
  { _id: "t24", categoryId: "dining", amount: 142, date: "2026-04-25", vendor: "Various" },
  { _id: "t25", categoryId: "gas", amount: 195, date: "2026-04-22", vendor: "Various" },
  { _id: "t26", categoryId: "rent", amount: 2200, date: "2026-04-01", vendor: "Greystar" },
  { _id: "t27", categoryId: "utilities", amount: 165, date: "2026-04-01", vendor: "PG&E" },
  { _id: "t28", categoryId: "hysa", amount: 800, date: "2026-04-15", vendor: "Ally Bank" },
  { _id: "t29", categoryId: "brokerage", amount: 600, date: "2026-04-01", vendor: "Vanguard" },
  { _id: "t30", categoryId: "shopping", amount: 75, date: "2026-04-10", vendor: "Amazon" },
  { _id: "t31", categoryId: "entertainment", amount: 60, date: "2026-04-18", vendor: "Spotify+Netflix" },
  { _id: "t32", categoryId: "groceries", amount: 720, date: "2026-03-30", vendor: "Various" },
  { _id: "t33", categoryId: "dining", amount: 280, date: "2026-03-29", vendor: "Various" },
  { _id: "t34", categoryId: "rent", amount: 2200, date: "2026-03-01", vendor: "Greystar" },
  { _id: "t35", categoryId: "utilities", amount: 210, date: "2026-03-01", vendor: "PG&E" },
  { _id: "t36", categoryId: "hysa", amount: 800, date: "2026-03-15", vendor: "Ally Bank" },
  { _id: "t37", categoryId: "brokerage", amount: 600, date: "2026-03-01", vendor: "Vanguard" },
  { _id: "t38", categoryId: "travel", amount: 680, date: "2026-03-20", vendor: "Airbnb", note: "Tahoe weekend" },
  { _id: "t39", categoryId: "gas", amount: 175, date: "2026-03-25", vendor: "Various" },
  { _id: "t40", categoryId: "groceries", amount: 760, date: "2026-02-28", vendor: "Various" },
  { _id: "t41", categoryId: "dining", amount: 310, date: "2026-02-26", vendor: "Various" },
  { _id: "t42", categoryId: "rent", amount: 2200, date: "2026-02-01", vendor: "Greystar" },
  { _id: "t43", categoryId: "utilities", amount: 245, date: "2026-02-01", vendor: "PG&E" },
  { _id: "t44", categoryId: "hysa", amount: 800, date: "2026-02-15", vendor: "Ally Bank" },
  { _id: "t45", categoryId: "brokerage", amount: 600, date: "2026-02-01", vendor: "Vanguard" },
  { _id: "t46", categoryId: "shopping", amount: 320, date: "2026-02-12", vendor: "Nike" },
  { _id: "t47", categoryId: "groceries", amount: 690, date: "2026-01-29", vendor: "Various" },
  { _id: "t48", categoryId: "dining", amount: 195, date: "2026-01-27", vendor: "Various" },
  { _id: "t49", categoryId: "rent", amount: 2200, date: "2026-01-01", vendor: "Greystar" },
  { _id: "t50", categoryId: "utilities", amount: 268, date: "2026-01-01", vendor: "PG&E", note: "Winter peak" },
  { _id: "t51", categoryId: "hysa", amount: 800, date: "2026-01-15", vendor: "Ally Bank" },
  { _id: "t52", categoryId: "brokerage", amount: 600, date: "2026-01-02", vendor: "Vanguard" },
  { _id: "t53", categoryId: "entertainment", amount: 95, date: "2026-01-12", vendor: "Concert tix" },
  { _id: "t54", categoryId: "rsu", amount: 12500, date: "2026-03-15", vendor: "Morgan Stanley", note: "Q1 vest" },
  { _id: "t55", categoryId: "rsu", amount: 12500, date: "2026-06-15", vendor: "Morgan Stanley", note: "Q2 vest" },
];

// History first (oldest), then the detailed recent months. Order is cosmetic —
// every reader sorts — but keeping it chronological makes the dataset readable.
export const SEED_TRANSACTIONS: SeedTransaction[] = [
  ...historicalTransactions(),
  ...RECENT_TRANSACTIONS,
];

// Pure doc builders — they turn a seed row into the persisted document, stamping
// the per-household namespaced id (`seedDocId`), the seeding household, and the
// `source: "seed"` provenance marker (#163). They live here with the dataset
// (both dependency-free) rather than in `seed.ts` so non-Next callers — the demo
// reseed script, tests — can import them without the `getDb` → `next/server`
// chain. `seed.ts` re-exports them for its existing callers.

// Omit optional fields when absent so Mongo doesn't persist `null` (mirrors
// createCategory's null-avoidance, which the readers in mappers.ts rely on).
export function buildCategoryDoc(
  c: SeedCategory,
  householdId: string,
  now: Date,
): CategoryDocument {
  return {
    _id: seedDocId(householdId, c._id),
    householdId,
    source: "seed",
    name: c.name,
    emoji: c.emoji,
    kind: c.kind,
    activeFrom: c.activeFrom,
    createdAt: now,
    ...(c.activeUntil !== undefined ? { activeUntil: c.activeUntil } : {}),
    ...(c.incomeFrequency !== undefined
      ? { incomeFrequency: c.incomeFrequency }
      : {}),
    ...(c.payCadence !== undefined ? { payCadence: c.payCadence } : {}),
  };
}

// One-time income sources have no baseline, so they get no target row.
export function buildTargetDoc(
  c: SeedCategory,
  householdId: string,
  now: Date,
): CategoryTargetDocument | undefined {
  if (c.initialMonthly === undefined) return undefined;
  return {
    _id: seedDocId(householdId, `${c._id}:${c.activeFrom}`),
    householdId,
    source: "seed",
    categoryId: seedDocId(householdId, c._id),
    monthly: c.initialMonthly,
    effectiveFrom: c.activeFrom,
    createdAt: now,
  };
}

export function buildTransactionDoc(
  t: SeedTransaction,
  householdId: string,
  now: Date,
): TransactionDocument {
  return {
    ...t,
    _id: seedDocId(householdId, t._id),
    // Reference the namespaced category id so the seed transaction resolves to
    // its (also namespaced) category within this household.
    categoryId: seedDocId(householdId, t.categoryId),
    householdId,
    source: "seed",
    createdAt: now,
  };
}
