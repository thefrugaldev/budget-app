import { MongoClient, type Db } from "mongodb";

const dbName = process.env.MONGODB_DB_NAME ?? "budget";

const clientOptions = {
  // Works on Atlas today; set false in env if an older Cosmos account requires it.
  retryWrites: process.env.MONGODB_RETRY_WRITES !== "false",
};

type MongoGlobal = typeof globalThis & {
  _mongoClientPromise?: Promise<MongoClient>;
};

const globalForMongo = globalThis as MongoGlobal;

function getUri(): string {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("Missing MONGODB_URI environment variable");
  }
  return uri;
}

function createClientPromise(): Promise<MongoClient> {
  const client = new MongoClient(getUri(), clientOptions);
  return client.connect();
}

function getClientPromise(): Promise<MongoClient> {
  if (process.env.NODE_ENV !== "production") {
    if (!globalForMongo._mongoClientPromise) {
      globalForMongo._mongoClientPromise = createClientPromise();
    }
    return globalForMongo._mongoClientPromise;
  }

  return createClientPromise();
}

export async function getDb(): Promise<Db> {
  const client = await getClientPromise();
  return client.db(dbName);
}
