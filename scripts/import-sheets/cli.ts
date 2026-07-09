import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { MongoClient, type Db } from "mongodb";

/**
 * Shared CLI scaffolding for the importer commands (extract / apply / parity).
 * Each of those was accreting its own copy of the same three things — the
 * main-module guard, the Mongo connect + db-name resolution, and the
 * run-and-exit wrapper — so they live here once.
 */

/**
 * True when `moduleUrl` (the caller's `import.meta.url`) is the process entry
 * point. Real paths on both sides so it holds up under symlinks and paths with
 * spaces / non-ASCII (where `import.meta.url` is percent-encoded). The URL is
 * passed in rather than read here so the comparison is against the *caller's*
 * module, not this one.
 */
export function isMainModule(moduleUrl: string): boolean {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    return realpathSync(fileURLToPath(moduleUrl)) === realpathSync(entry);
  } catch {
    return false;
  }
}

/**
 * Run `main` and exit with its code when the calling file is the entry point;
 * a thrown error prints `"<label> error: …"` and exits 1. No-ops when imported
 * (e.g. by tests, which call the command function directly).
 */
export function runCli(
  moduleUrl: string,
  label: string,
  main: () => Promise<number>,
): void {
  if (!isMainModule(moduleUrl)) return;
  main()
    .then((code) => process.exit(code))
    .catch((err) => {
      process.stderr.write(
        `${label} error: ${err instanceof Error ? err.message : String(err)}\n`,
      );
      process.exit(1);
    });
}

/** Target db name: explicit `--db`, else `MONGODB_DB_NAME`, else `"budget"` (matches the app). */
export function resolveDbName(explicit?: string): string {
  return explicit ?? process.env.MONGODB_DB_NAME ?? "budget";
}

/** Connect to `MONGODB_URI` and hand back the client (caller closes it) + chosen db. */
export async function connectMongo(
  dbName?: string,
): Promise<{ client: MongoClient; db: Db }> {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("Missing MONGODB_URI environment variable");
  const client = await new MongoClient(uri).connect();
  return { client, db: client.db(resolveDbName(dbName)) };
}
