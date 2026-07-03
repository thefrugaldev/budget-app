import type { Category, CategoryTarget, Transaction } from "@/types/budget";
import type { Household, Invite, Member, User } from "@/types/auth";
import type {
  CategoryDocument,
  CategoryTargetDocument,
  HouseholdDocument,
  InviteDocument,
  MemberDocument,
  TransactionDocument,
  UserDocument,
} from "./documents";

export function toCategory(doc: CategoryDocument): Category {
  return {
    id: doc._id,
    name: doc.name,
    // `?? undefined` normalises both an absent field (new icon-based docs) and
    // a leaked Mongo null.
    emoji: doc.emoji ?? undefined,
    icon: doc.icon ?? undefined,
    kind: doc.kind,
    activeFrom: doc.activeFrom,
    // Mongo writes a missing optional as `null` (not omitted) when the
    // insert payload included `activeUntil: undefined`. Normalise so the
    // rest of the app can rely on the `?: string` type literally — checks
    // like `activeUntil !== undefined` and `monthLabel(activeUntil!)`
    // would otherwise crash on the leaked null.
    activeUntil: doc.activeUntil ?? undefined,
    // Read-time migration (story 8): an income doc with no stored frequency
    // predates #46 and reads back as "recurring". Non-income categories have
    // no frequency at all. `?? undefined` also normalises a leaked Mongo null.
    incomeFrequency:
      doc.incomeFrequency ?? (doc.kind === "income" ? "recurring" : undefined),
    // Legacy recurring sources and one-time sources both leave this unset;
    // the cadence-unset case falls back to calendar-day pro-ration (story 10).
    payCadence: doc.payCadence ?? undefined,
    // Optional paycheck phase anchor; unset sources fall back to the first of
    // `activeFrom`. `?? undefined` normalises a leaked Mongo null.
    firstPaycheckDate: doc.firstPaycheckDate ?? undefined,
  };
}

export function toCategoryTarget(doc: CategoryTargetDocument): CategoryTarget {
  return {
    categoryId: doc.categoryId,
    monthly: doc.monthly,
    effectiveFrom: doc.effectiveFrom,
  };
}

export function toTransaction(doc: TransactionDocument): Transaction {
  return {
    id: doc._id,
    categoryId: doc.categoryId,
    amount: doc.amount,
    date: doc.date,
    vendor: doc.vendor,
    note: doc.note,
  };
}

// --- Auth mappers (#111 chunk 2). The domain shapes are Clerk-agnostic; the
// provider link is reassembled from the flat document fields. `householdId`
// is a persistence/tenancy concern and stays off the budget domain types, so
// `toCategory`/`toTransaction` above deliberately don't read it. ---

export function toUser(doc: UserDocument): User {
  return {
    id: doc._id,
    email: doc.email,
    provider: { provider: doc.provider, subjectId: doc.providerSubjectId },
  };
}

export function toHousehold(doc: HouseholdDocument): Household {
  return { id: doc._id };
}

export function toMember(doc: MemberDocument): Member {
  return {
    userId: doc.userId,
    householdId: doc.householdId,
    role: doc.role,
  };
}

export function toInvite(doc: InviteDocument): Invite {
  return {
    id: doc._id,
    householdId: doc.householdId,
    email: doc.email,
    role: doc.role,
    status: doc.status,
  };
}
