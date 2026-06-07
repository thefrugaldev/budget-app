// BSON document shapes stored in Mongo-compatible databases.
// Keep fields simple and portable across Atlas and Cosmos DB Mongo API.

import type { CategoryKind } from "@/types/budget";

export type CategoryDocument = {
  _id: string;
  name: string;
  emoji: string;
  kind: CategoryKind;
  activeFrom: string; // "YYYY-MM"
  activeUntil?: string; // "YYYY-MM"
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
  amount: number;
  // ISO date string (YYYY-MM-DD) for portable range queries.
  date: string;
  vendor?: string;
  note?: string;
  items?: string[];
  createdAt: Date;
};
