import type { Category, CategoryTarget, Transaction } from "@/types/budget";
import type {
  CategoryDocument,
  CategoryTargetDocument,
  TransactionDocument,
} from "./documents";

export function toCategory(doc: CategoryDocument): Category {
  return {
    id: doc._id,
    name: doc.name,
    emoji: doc.emoji,
    // `?? undefined` normalises a leaked Mongo null on legacy docs.
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
