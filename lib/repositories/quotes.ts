import { COLLECTIONS } from "@/lib/db/collections";
import { getDb } from "@/lib/db/client";
import type { QuoteDocument } from "@/lib/db/documents";
import type { CachedQuote, QuoteCache } from "@/types/net-worth";

/**
 * Mongo-backed {@link QuoteCache} for the price layer (#109 chunk 3).
 *
 * **App-global, not household data** — a market price is the same for everyone
 * (ADR 0003) — so this reaches Mongo via raw `getDb`, *not* `scopedCollection`,
 * and is deliberately NOT listed in `household-scope.guard.test.ts` (like
 * `seed.ts` / `backfill.ts`, which also opt out visibly). `_id` is the ticker,
 * so a write is an idempotent upsert per symbol.
 */
export const mongoQuoteCache: QuoteCache = {
  async read(tickers: string[]): Promise<Map<string, CachedQuote>> {
    const out = new Map<string, CachedQuote>();
    if (tickers.length === 0) return out;
    const db = await getDb();
    const docs = await db
      .collection<QuoteDocument>(COLLECTIONS.quotes)
      .find({ _id: { $in: tickers } })
      .toArray();
    for (const doc of docs) {
      out.set(doc._id, { ticker: doc._id, price: doc.price, asOf: doc.asOf.toISOString() });
    }
    return out;
  },

  async write(quotes: CachedQuote[]): Promise<void> {
    if (quotes.length === 0) return;
    const db = await getDb();
    await db.collection<QuoteDocument>(COLLECTIONS.quotes).bulkWrite(
      quotes.map((q) => ({
        updateOne: {
          filter: { _id: q.ticker },
          update: { $set: { price: q.price, asOf: new Date(q.asOf) } },
          upsert: true,
        },
      })),
    );
  },
};
