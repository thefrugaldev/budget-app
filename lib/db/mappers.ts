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
    kind: doc.kind,
    activeFrom: doc.activeFrom,
    activeUntil: doc.activeUntil,
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
