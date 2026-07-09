import { MongoClient, type Db } from "mongodb";
import { MongoMemoryServer } from "mongodb-memory-server";

/**
 * Disposable-MongoDB test harness — the repo's first (introduced by #118
 * chunk 3, also wanted by the auth backfill follow-up). Spins an ephemeral
 * in-memory `mongod` (via `mongodb-memory-server`, self-contained — no external
 * database or CI service needed) and hands back a connected client + db.
 *
 * Usage in an integration test:
 *
 *   let mongo: MemoryMongo;
 *   beforeAll(async () => { mongo = await startMemoryMongo(); }, 60_000);
 *   afterAll(async () => { await mongo.stop(); });
 *   beforeEach(() => mongo.reset());
 *
 * The first `beforeAll` in a run downloads the mongod binary once (cached under
 * node_modules/.cache), so give it a generous timeout.
 */
export type MemoryMongo = {
  client: MongoClient;
  db: Db;
  uri: string;
  /** Drop every collection — call between tests for isolation. */
  reset: () => Promise<void>;
  /** Stop the client and the server. */
  stop: () => Promise<void>;
};

export async function startMemoryMongo(dbName = "budget-test"): Promise<MemoryMongo> {
  const server = await MongoMemoryServer.create();
  const uri = server.getUri();
  const client = await new MongoClient(uri).connect();
  const db = client.db(dbName);

  return {
    client,
    db,
    uri,
    async reset() {
      const collections = await db.collections();
      await Promise.all(collections.map((c) => c.deleteMany({})));
    },
    async stop() {
      await client.close();
      await server.stop();
    },
  };
}
