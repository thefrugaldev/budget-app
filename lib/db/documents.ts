// BSON document shapes stored in Mongo-compatible databases.
// Keep fields simple and portable across Atlas and Cosmos DB Mongo API.

export type CategoryDocument = {
  _id: string;
  name: string;
  createdAt: Date;
};

export type TransactionDocument = {
  _id: string;
  categoryId: string;
  amount: number;
  // ISO date string (YYYY-MM-DD) for portable range queries.
  date: string;
  note?: string;
  createdAt: Date;
};
