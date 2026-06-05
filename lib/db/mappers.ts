import type { Category, Transaction } from "@/types/budget";
import type { CategoryDocument, TransactionDocument } from "./documents";

export function toCategory(doc: CategoryDocument): Category {
  return {
    id: doc._id,
    name: doc.name,
  };
}

export function toTransaction(doc: TransactionDocument): Transaction {
  return {
    id: doc._id,
    categoryId: doc.categoryId,
    amount: doc.amount,
    date: doc.date,
    note: doc.note,
  };
}
