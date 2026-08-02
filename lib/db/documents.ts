// BSON document shapes stored in Mongo-compatible databases.
// Keep fields simple and portable across Atlas and Cosmos DB Mongo API.

import type { CategoryKind, IncomeFrequency, PayCadence } from "@/types/budget";
import type { AccountClass, AssetKind, Holding, SnapshotComposition } from "@/types/net-worth";
import type { InvitableRole, InviteStatus, Role } from "@/types/auth";

// Household ownership stamp (#111 ADR 0004). Added to every user-data
// collection in chunk 2 but **written, not yet filtered**: the bootstrap
// backfill (`runBackfill`) stamps existing docs, and chunk 4 makes reads filter
// by it. Optional here so pre-auth docs and the still-open app stay valid — the
// field is absent until a household exists and the backfill runs. The quote
// cache (a future collection) is deliberately exempt: a price is app-global,
// not household data (story 16).
type HouseholdOwned = {
  householdId?: string;
};

// Provenance for documents synced from the Excel archive (#118 / ADR 0005).
// Absent on hand-entered and seed docs. `importRef` (`<file>!<sheet>!<cell>#<line>`)
// is the human-readable source pointer: it makes re-apply a deterministic sync
// (upsert by `_id` + delete orphaned refs), powers source traceability, and —
// by its mere presence — marks a doc as imported so the danger-zone reset spares
// it unless explicitly opted in (chunk 5, story 14).
type Imported = {
  importRef?: string;
};

// Provenance for demo/seed documents (#163). Present only on docs written by
// the seeder, mirroring how `importRef` marks archive-imported docs. Its mere
// presence identifies seed data — recognition is `{ source: "seed" }`, immune
// to seed-slug drift, so a hand-entered doc filed under a seed category is
// cleanly distinguishable from seed. Scoped to the three collections the
// seeder writes (categories, targets, transactions).
type Seeded = {
  source?: "seed";
};

export type CategoryDocument = HouseholdOwned & Imported & Seeded & {
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

export type CategoryTargetDocument = HouseholdOwned & Imported & Seeded & {
  _id: string;
  categoryId: string;
  monthly: number;
  effectiveFrom: string; // "YYYY-MM"
  createdAt: Date;
};

// The persisted memory that a Target suggestion was dismissed (#186, ADR 0006).
// The *only* new state the suggestions feature stores — suggestions themselves
// are computed on read, never materialized. One row per category (a
// `(householdId, categoryId)` unique index, added with the repository in a later
// chunk); re-dismissing upserts. `dismissedMedian` / `dismissedAgainstTarget`
// snapshot the observed level so the detector can re-surface on a materially
// larger divergence, and `dismissedAt` is the snooze clock. Not household-exempt:
// a dismissal is household data like every other user document.
export type TargetSuggestionDismissalDocument = HouseholdOwned & {
  _id: string;
  categoryId: string;
  dismissedMedian: number;
  dismissedAgainstTarget: number;
  dismissedAt: Date;
};

export type TransactionDocument = HouseholdOwned & Imported & Seeded & {
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
// auto-seed-disabled marker written by the danger-zone reset). Still gains a
// `householdId` (via `HouseholdOwned`) per ADR 0004 so the auto-seed marker is
// stamped by the backfill and survives chunk 4's household-scoped reads.
export type MetaDocument = HouseholdOwned & {
  _id: string;
  clearedAt?: Date;
};

// --- Net Worth (#109 chunk 2, ADR 0003). Accounts + valuation snapshots — a
// distinct entity set from budget Categories that never reconciles against them.
// Household-owned like all user data; the domain mappers project these to the
// `@/types/net-worth` shapes. ---

export type AccountDocument = HouseholdOwned & Imported & {
  _id: string;
  name: string;
  class: AccountClass;
  // Asset accounts only; absent for liabilities (always manual-balance).
  kind?: AssetKind;
  // Manual balance in dollars for cash / property / liability accounts.
  balance?: number;
  // Positions for an investment account.
  holdings?: Holding[];
  // ISO date the account was closed; absent while open. A closed account leaves
  // the live headline / nest egg / check-in but keeps its snapshot history.
  closedAt?: string;
  createdAt: Date;
};

export type SnapshotDocument = HouseholdOwned & Imported & {
  _id: string;
  accountId: string;
  date: string; // ISO "YYYY-MM-DD"
  // The account's own value as a non-negative magnitude; the account's `class`
  // supplies the sign in aggregation. Closing an account records a final
  // `value: 0` snapshot.
  value: number;
  // What the value was made of at record time (the check-in write path, #109
  // chunk 5): resolved holdings/prices, or the manual balance. Absent on the
  // chunk-2 close snapshot (value 0, no composition to keep). Persisted because
  // history is never reconstructed from past prices (ADR 0003) — the trajectory
  // series ignores it; it's kept for a future composition breakdown.
  composition?: SnapshotComposition;
  createdAt: Date;
};

// FIRE assumptions (#110 chunk 3, ADR 0003). **Exactly one document per
// household** (unique index on `householdId`) holding only the knobs the user has
// explicitly overridden — an absent field tracks its data-derived / constant
// default at resolution time (`resolveAssumptions`), so an untouched knob follows
// the budget data as it changes. Rate fields are percentages, matching the domain
// type. No `_id` meaning beyond identity; the household is the real key.
export type FireAssumptionsDocument = HouseholdOwned & {
  _id: string;
  monthlyRetirementSpend?: number;
  monthlyContribution?: number;
  nominalReturn?: number;
  inflation?: number;
  safeWithdrawalRate?: number;
  // Four-digit birth year. The one knob with no default — absent until the user sets it.
  birthYear?: number;
  traditionalRetirementAge?: number;
  updatedAt: Date;
};

// Cached market quote (#109 chunk 3, ADR 0003). **App-global, not household
// data** — a price is the same for everyone — so this document carries no
// `householdId` and its cache reaches Mongo via raw `getDb`, not the
// household-scoped collection. `_id` is the ticker (one quote per symbol).
export type QuoteDocument = {
  _id: string; // ticker
  price: number;
  asOf: Date;
};

// --- Auth collections (#111 chunk 2). Clerk-agnostic by design (ADR 0004): no
// document references a Clerk id except the User's provider link below. Domain
// mappers in `mappers.ts` project these to the `@/types/auth` shapes. ---

// Our stable identity record. Holds the provider link (`provider` +
// `providerSubjectId` — Clerk's user id at v1) and the verified email; a future
// provider swap relinks by email without reshaping domain data (ADR 0004).
export type UserDocument = {
  _id: string;
  email: string;
  provider: "clerk";
  providerSubjectId: string;
  createdAt: Date;
};

// The unit of data ownership. Exactly one exists in v1 (bootstrap-created);
// multiple households are out of scope.
export type HouseholdDocument = {
  _id: string;
  createdAt: Date;
};

// A user's role-bearing association with a household.
export type MemberDocument = {
  _id: string;
  householdId: string;
  userId: string;
  role: Role;
  createdAt: Date;
};

// A pending, owner-created email+role grant. `status` flips to "accepted" (with
// `acceptedAt`) when a matching sign-in consumes it; a consumed invite never
// re-grants (see `matchInvite`).
export type InviteDocument = {
  _id: string;
  householdId: string;
  // Target email. Not guaranteed pre-normalized — compare via `normalizeEmail`.
  email: string;
  role: InvitableRole;
  status: InviteStatus;
  createdAt: Date;
  acceptedAt?: Date;
};
