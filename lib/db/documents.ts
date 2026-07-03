// BSON document shapes stored in Mongo-compatible databases.
// Keep fields simple and portable across Atlas and Cosmos DB Mongo API.

import type { CategoryKind, IncomeFrequency, PayCadence } from "@/types/budget";
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

export type CategoryDocument = HouseholdOwned & {
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

export type CategoryTargetDocument = HouseholdOwned & {
  _id: string;
  categoryId: string;
  monthly: number;
  effectiveFrom: string; // "YYYY-MM"
  createdAt: Date;
};

export type TransactionDocument = HouseholdOwned & {
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
