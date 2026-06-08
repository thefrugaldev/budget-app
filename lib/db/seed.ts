// One-time idempotent seed for the dev database. Runs on first page load
// when the `categories` collection is empty, then no-ops on subsequent
// requests within the process (cached promise) and across process restarts
// (collection is no longer empty).
//
// Mirrors the previous `lib/fixtures/budget.ts` dataset so the pages render
// the same numbers they did before the cutover. Once chunk 6 introduces a
// real seed for income, fold income categories in here too.

import type { Db } from "mongodb";

import { getDb } from "./client";
import { COLLECTIONS } from "./collections";
import type {
  CategoryDocument,
  CategoryTargetDocument,
  TransactionDocument,
} from "./documents";
import { ensureIndexes } from "./indexes";

const ACTIVE_FROM = "2026-01";

type SeedCategory = Omit<CategoryDocument, "createdAt"> & {
  initialMonthly: number;
};

const CATEGORIES: SeedCategory[] = [
  { _id: "groceries", name: "Groceries", emoji: "🛒", kind: "expense", activeFrom: ACTIVE_FROM, initialMonthly: 800 },
  { _id: "dining", name: "Dining out", emoji: "🍔", kind: "expense", activeFrom: ACTIVE_FROM, initialMonthly: 300 },
  { _id: "gas", name: "Gas", emoji: "⛽", kind: "expense", activeFrom: ACTIVE_FROM, initialMonthly: 180 },
  { _id: "utilities", name: "Utilities", emoji: "💡", kind: "expense", activeFrom: ACTIVE_FROM, initialMonthly: 220 },
  { _id: "rent", name: "Rent", emoji: "🏠", kind: "expense", activeFrom: ACTIVE_FROM, initialMonthly: 2200 },
  { _id: "entertainment", name: "Entertainment", emoji: "🎬", kind: "expense", activeFrom: ACTIVE_FROM, initialMonthly: 150 },
  { _id: "shopping", name: "Shopping", emoji: "🛍️", kind: "expense", activeFrom: ACTIVE_FROM, initialMonthly: 200 },
  { _id: "travel", name: "Travel", emoji: "✈️", kind: "expense", activeFrom: ACTIVE_FROM, initialMonthly: 250 },
  { _id: "hysa", name: "HYSA", emoji: "🏦", kind: "savings", activeFrom: ACTIVE_FROM, initialMonthly: 800 },
  { _id: "brokerage", name: "Brokerage", emoji: "📈", kind: "savings", activeFrom: ACTIVE_FROM, initialMonthly: 600 },
  { _id: "vacation", name: "Vacation fund", emoji: "🏖️", kind: "savings", activeFrom: ACTIVE_FROM, initialMonthly: 200 },
];

type SeedTransaction = Omit<TransactionDocument, "createdAt">;

const TRANSACTIONS: SeedTransaction[] = [
  { _id: "t1", categoryId: "groceries", amount: 87.42, date: "2026-06-04", vendor: "Whole Foods", items: ["produce", "salmon", "olive oil"] },
  { _id: "t2", categoryId: "dining", amount: 24.5, date: "2026-06-04", vendor: "Tacos El Gordo" },
  { _id: "t3", categoryId: "gas", amount: 52.18, date: "2026-06-03", vendor: "Shell" },
  { _id: "t4", categoryId: "hysa", amount: 400, date: "2026-06-02", vendor: "Ally Bank", note: "Mid-month transfer" },
  { _id: "t5", categoryId: "groceries", amount: 64.11, date: "2026-06-02", vendor: "Trader Joe's", items: ["snacks", "frozen meals"] },
  { _id: "t6", categoryId: "rent", amount: 2200, date: "2026-06-01", vendor: "Greystar" },
  { _id: "t7", categoryId: "utilities", amount: 142.33, date: "2026-06-01", vendor: "PG&E" },
  { _id: "t8", categoryId: "brokerage", amount: 300, date: "2026-06-01", vendor: "Vanguard" },
  { _id: "t9", categoryId: "groceries", amount: 92.5, date: "2026-05-29", vendor: "Whole Foods", items: ["weekly haul"] },
  { _id: "t10", categoryId: "dining", amount: 48.0, date: "2026-05-28", vendor: "Sushi Ran" },
  { _id: "t11", categoryId: "entertainment", amount: 35.0, date: "2026-05-27", vendor: "AMC Theatres" },
  { _id: "t12", categoryId: "shopping", amount: 220, date: "2026-05-24", vendor: "Uniqlo", items: ["summer shirts"] },
  { _id: "t13", categoryId: "groceries", amount: 78.3, date: "2026-05-22", vendor: "Trader Joe's" },
  { _id: "t14", categoryId: "gas", amount: 48.99, date: "2026-05-20", vendor: "Chevron" },
  { _id: "t15", categoryId: "hysa", amount: 800, date: "2026-05-15", vendor: "Ally Bank" },
  { _id: "t16", categoryId: "groceries", amount: 105.2, date: "2026-05-14", vendor: "Whole Foods", items: ["dinner party"] },
  { _id: "t17", categoryId: "dining", amount: 88.4, date: "2026-05-12", vendor: "Nopa" },
  { _id: "t18", categoryId: "vacation", amount: 250, date: "2026-05-10", vendor: "Marcus", note: "Italy trip" },
  { _id: "t19", categoryId: "rent", amount: 2200, date: "2026-05-01", vendor: "Greystar" },
  { _id: "t20", categoryId: "utilities", amount: 188.4, date: "2026-05-01", vendor: "PG&E" },
  { _id: "t21", categoryId: "brokerage", amount: 600, date: "2026-05-01", vendor: "Vanguard" },
  { _id: "t22", categoryId: "travel", amount: 412, date: "2026-05-03", vendor: "United", note: "SFO → SEA" },
  { _id: "t23", categoryId: "groceries", amount: 410, date: "2026-04-28", vendor: "Costco", items: ["bulk run"] },
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
];

let seedPromise: Promise<void> | undefined;

export function ensureSeeded(): Promise<void> {
  if (!seedPromise) {
    seedPromise = doSeed().catch((err) => {
      seedPromise = undefined;
      throw err;
    });
  }
  return seedPromise;
}

async function doSeed(): Promise<void> {
  const db = await getDb();
  await ensureIndexes(db);

  const categoryCount = await db
    .collection(COLLECTIONS.categories)
    .countDocuments({}, { limit: 1 });
  if (categoryCount > 0) return;

  const now = new Date();

  await seedCategories(db, now);
  await seedTargets(db, now);
  await seedTransactions(db, now);
}

async function seedCategories(db: Db, now: Date): Promise<void> {
  const docs: CategoryDocument[] = CATEGORIES.map((c) => ({
    _id: c._id,
    name: c.name,
    emoji: c.emoji,
    kind: c.kind,
    activeFrom: c.activeFrom,
    createdAt: now,
  }));
  await db.collection<CategoryDocument>(COLLECTIONS.categories).insertMany(docs);
}

async function seedTargets(db: Db, now: Date): Promise<void> {
  const docs: CategoryTargetDocument[] = CATEGORIES.map((c) => ({
    _id: `${c._id}:${c.activeFrom}`,
    categoryId: c._id,
    monthly: c.initialMonthly,
    effectiveFrom: c.activeFrom,
    createdAt: now,
  }));
  await db
    .collection<CategoryTargetDocument>(COLLECTIONS.categoryTargets)
    .insertMany(docs);
}

async function seedTransactions(db: Db, now: Date): Promise<void> {
  const docs: TransactionDocument[] = TRANSACTIONS.map((t) => ({
    ...t,
    createdAt: now,
  }));
  await db
    .collection<TransactionDocument>(COLLECTIONS.transactions)
    .insertMany(docs);
}
