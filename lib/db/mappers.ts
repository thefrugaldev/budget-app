import type { Category, CategoryTarget, Transaction } from "@/types/budget";
import type { FireAssumptionOverrides } from "@/types/fire";
import type { TargetSuggestionDismissal } from "@/types/target-suggestion";
import type { Account, Snapshot } from "@/types/net-worth";
import type { Household, Invite, Member, User } from "@/types/auth";
import type {
  AccountDocument,
  CategoryDocument,
  CategoryTargetDocument,
  FireAssumptionsDocument,
  HouseholdDocument,
  InviteDocument,
  MemberDocument,
  SnapshotDocument,
  TargetSuggestionDismissalDocument,
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

// Target-suggestion dismissal (#186 chunk 3). Drops the persistence fields
// (`_id`, `householdId`) and projects the stored `dismissedAt` Date to an ISO
// string, matching the domain shape the detector reads.
export function toTargetSuggestionDismissal(
  doc: TargetSuggestionDismissalDocument,
): TargetSuggestionDismissal {
  return {
    categoryId: doc.categoryId,
    dismissedMedian: doc.dismissedMedian,
    dismissedAgainstTarget: doc.dismissedAgainstTarget,
    dismissedAt: doc.dismissedAt.toISOString(),
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
    // Provenance surfaced for the filter + "Monthly total" chip (#165 chunk 3).
    // `importRef`'s mere presence marks an archive-imported doc.
    imported: doc.importRef !== undefined,
  };
}

// --- Net Worth mappers (#109 chunk 2). `householdId` is a tenancy concern and
// stays off the domain shapes; the snapshot's composition is a document-only
// detail the history math doesn't read, so `toSnapshot` projects value alone. ---

export function toAccount(doc: AccountDocument): Account {
  return {
    id: doc._id,
    name: doc.name,
    class: doc.class,
    // `?? undefined` normalises both an absent field and a leaked Mongo null,
    // so the `?: T` optionals read literally (a `null` would be truthy-wrong).
    kind: doc.kind ?? undefined,
    balance: doc.balance ?? undefined,
    holdings: doc.holdings ?? undefined,
    institution: doc.institution ?? undefined,
    closedAt: doc.closedAt ?? undefined,
  };
}

export function toSnapshot(doc: SnapshotDocument): Snapshot {
  return {
    accountId: doc.accountId,
    date: doc.date,
    value: doc.value,
  };
}

// --- FIRE mappers (#110 chunk 3). The document stores only overridden knobs; the
// domain override set is the same partial with persistence fields (`_id`,
// `householdId`, `updatedAt`) stripped and any leaked Mongo `null` normalised to
// absent, so `resolveAssumptions` sees a clean `field ?? default`. ---

export function toFireAssumptionOverrides(doc: FireAssumptionsDocument): FireAssumptionOverrides {
  return {
    ...(doc.monthlyRetirementSpend != null ? { monthlyRetirementSpend: doc.monthlyRetirementSpend } : {}),
    ...(doc.monthlyContribution != null ? { monthlyContribution: doc.monthlyContribution } : {}),
    ...(doc.nominalReturn != null ? { nominalReturn: doc.nominalReturn } : {}),
    ...(doc.inflation != null ? { inflation: doc.inflation } : {}),
    ...(doc.safeWithdrawalRate != null ? { safeWithdrawalRate: doc.safeWithdrawalRate } : {}),
    ...(doc.birthYear != null ? { birthYear: doc.birthYear } : {}),
    ...(doc.traditionalRetirementAge != null
      ? { traditionalRetirementAge: doc.traditionalRetirementAge }
      : {}),
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
