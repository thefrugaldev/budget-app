import { connection } from "next/server";
import { MongoClient, type Db } from "mongodb";

import { ensureIndexes } from "./indexes";

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

// Prod uses a module-level singleton so each request reuses the same
// connected client. Dev caches on globalThis so HMR re-evaluations of this
// module don't multiply clients across reloads.
let prodClientPromise: Promise<MongoClient> | undefined;

function getClientPromise(): Promise<MongoClient> {
  if (process.env.NODE_ENV !== "production") {
    if (!globalForMongo._mongoClientPromise) {
      globalForMongo._mongoClientPromise = createClientPromise();
    }
    return globalForMongo._mongoClientPromise;
  }

  if (!prodClientPromise) {
    prodClientPromise = createClientPromise();
  }
  return prodClientPromise;
}

export async function getDb(): Promise<Db> {
  await connection();
  const client = await getClientPromise();
  const db = client.db(dbName);
  // Index bootstrapping is a process-level concern, so it lives at the single
  // connection chokepoint rather than being re-invoked in every repository
  // function. Memoized in `ensureIndexes` (built once per process, retried on
  // failure), so this adds only a resolved-promise await after the first call.
  await ensureIndexes(db);
  return db;
}
