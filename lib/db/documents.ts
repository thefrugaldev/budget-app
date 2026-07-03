// BSON document shapes stored in Mongo-compatible databases.
// Keep fields simple and portable across Atlas and Cosmos DB Mongo API.

import type { CategoryKind, IncomeFrequency, PayCadence } from "@/types/budget";

export type CategoryDocument = {
  _id: string;
  name: string;
  // Legacy display glyph. Absent on new icon-based docs (#80 chunk 4).
  emoji?: string;
  // Chosen lucide icon name (#80 chunk 4). Absent on seed/legacy docs, which
  // fall back to `emoji` on read via `staticIconFor`.
  icon?: string;
  kind: CategoryKind;
  activeFrom: string; // "YYYY-MM"
  activeUntil?: string; // "YYYY-MM"
  // Income-only (#46). Absent on legacy income docs — `toCategory` defaults
  // those to "recurring" on read rather than via a write migration.
  incomeFrequency?: IncomeFrequency;
  payCadence?: PayCadence;
  firstPaycheckDate?: string; // "YYYY-MM-DD" — phase anchor for paychecks
  createdAt: Date;
};

export type CategoryTargetDocument = {
  _id: string;
  categoryId: string;
  monthly: number;
  effectiveFrom: string; // "YYYY-MM"
  createdAt: Date;
};

export type TransactionDocument = {
  _id: string;
  categoryId: string;
  // Signed: positive = outflow/contribution/income, negative = refund/withdrawal/reversed.
  amount: number;
  // ISO date string (YYYY-MM-DD) for portable range queries.
  date: string;
  vendor?: string;
  note?: string;
  createdAt: Date;
};

// App-level state, not user data. `_id` is a well-known string key (e.g. the
// auto-seed-disabled marker written by the danger-zone reset).
export type MetaDocument = {
  _id: string;
  clearedAt?: Date;
};
