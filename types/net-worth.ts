// Net Worth domain types (#109, ADR 0003). Accounts are a distinct entity set
// from the budget's Categories and never reconcile against them — the two halves
// of the app meet only in FIRE math. These are the *domain* shapes the pure
// net-worth math works on; chunk 2 adds the Mongo document/repository layer that
// maps onto them.

/** Assets add to net worth; liabilities subtract. */
export type AccountClass = "asset" | "liability";

/**
 * The kind of an asset account. `cash` and `property` carry a manual balance;
 * `investment` is valued as holdings × market price. Only meaningful for assets
 * — liabilities are always manual-balance and carry no kind.
 */
export type AssetKind = "cash" | "investment" | "property";

/** A position inside an investment account: a ticker and a share quantity. */
export type Holding = {
  ticker: string;
  quantity: number;
  /**
   * Manual price override in dollars (#109 chunk 3, story 12). When set it wins
   * over the market feed — so a ticker the feed can't quote (or quotes wrongly)
   * never blocks valuation. Absent means "use the feed price".
   */
  priceOverride?: number;
};

/**
 * A manually-maintained financial account. Investment accounts hold `holdings`
 * (valued at market price); cash, property, and liability accounts carry a
 * manual `balance`. A closed account (`closedAt` set) leaves the live headline,
 * nest egg, and check-in but keeps its recorded history (ADR 0003 lifecycle:
 * lifecycle as data, not deletion).
 */
export type Account = {
  id: string;
  name: string;
  class: AccountClass;
  /** Asset accounts only; undefined for liabilities. */
  kind?: AssetKind;
  /** Manual balance for cash / property / liability accounts. */
  balance?: number;
  /** Positions for an investment account. */
  holdings?: Holding[];
  /** ISO date the account was closed, if it has been; undefined while open. */
  closedAt?: string;
};

/**
 * A dated record of an account's value at the moment the user recorded it —
 * the source of truth for net-worth history (never reconstructed from
 * historical prices). `value` is the account's own **magnitude**; the owning
 * account's `class` supplies the sign in aggregation. The holdings/prices or
 * balance behind the value are persisted at the document layer (chunk 2); the
 * pure history math needs only `accountId`, `date`, and `value`.
 */
export type Snapshot = {
  accountId: string;
  date: string; // ISO "YYYY-MM-DD"
  value: number;
};

/**
 * Resolves a ticker to its current price (in dollars), or `undefined` when no
 * price is available. The valuation math stays pure and network-free by taking
 * this lookup as a parameter; chunk 3's price layer (feed + cache + manual
 * override) supplies the concrete resolver.
 */
export type PriceLookup = (ticker: string) => number | undefined;

/** The live net-worth headline: both subtotals plus the signed net figure. */
export type NetWorthHeadline = {
  /** Sum of open asset-account values. */
  assets: number;
  /** Sum of open liability-account values, as a positive magnitude. */
  liabilities: number;
  /** `assets − liabilities`. */
  net: number;
};

/** One month of recorded net-worth history, for the trajectory chart. */
export type NetWorthPoint = {
  ym: string; // "YYYY-MM"
  net: number;
};

// --- Price layer contracts (#109 chunk 3, ADR 0003). The provider is a swap,
// not a commitment; valuation depends only on these shapes, never on Finnhub. ---

/**
 * A source of current market prices for tickers. The Finnhub free-tier
 * implementation is the first, but valuation logic must never depend on it —
 * only on this interface (ADR 0003). Tickers the source can't quote are omitted
 * from the returned map (they fall to a manual override or read as unpriced).
 */
export interface PriceProvider {
  getQuotes(tickers: string[]): Promise<Map<string, number>>;
}

/** A cached market quote: the price and when it was fetched (ISO datetime). */
export type CachedQuote = {
  ticker: string;
  price: number;
  asOf: string;
};

/**
 * The persistence seam behind the stale-refresh policy — implemented over Mongo
 * in production, faked in tests. App-global (a price is not household data), so
 * its implementation uses the raw db rather than a household-scoped collection.
 */
export interface QuoteCache {
  read(tickers: string[]): Promise<Map<string, CachedQuote>>;
  write(quotes: CachedQuote[]): Promise<void>;
}
