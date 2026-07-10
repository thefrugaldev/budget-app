import type { Account, PriceLookup, SnapshotComposition } from "@/types/net-worth";

import { accountValue } from "./valuation";

/**
 * Build the snapshot set a check-in records (#109 chunk 5, story 8): one dated
 * snapshot per **open** account, each carrying the account's current value *and*
 * the composition behind it. Closed accounts are skipped — they already recorded
 * a final `value: 0` snapshot when closed and stay out of the live check-in.
 *
 * Pure and network-free: prices arrive via `priceFor` (the caller resolves the
 * feed/cache/override before calling), so the recording logic is unit-testable
 * without the DB or HTTP. The action layer persists each result via
 * `createSnapshot`.
 *
 * The recorded composition mirrors how {@link accountValue} sums: an investment
 * account records each holding with the exact price used (`priceOverride ?? feed
 * ?? 0`), so `Σ quantity × price === value` by construction; every other account
 * records its manual `balance`. Recording this now is the point — history is
 * never reconstructed from past prices (ADR 0003), so the makeup of a past
 * valuation is only knowable if captured at record time.
 *
 * **Contract:** the caller must have resolved a price for every non-override
 * holding before calling — enforce it with {@link unpricedTickers} and refuse
 * the check-in otherwise. The `?? 0` below is only a defensive floor for that
 * already-rejected case; a snapshot must never silently under-record an unpriced
 * holding as $0, because that undershoot would be baked into history forever.
 */
export function buildCheckInSnapshots(
  accounts: Account[],
  priceFor: PriceLookup,
  date: string,
): { accountId: string; date: string; value: number; composition: SnapshotComposition }[] {
  const snapshots: {
    accountId: string;
    date: string;
    value: number;
    composition: SnapshotComposition;
  }[] = [];

  for (const account of accounts) {
    if (account.closedAt) continue;

    let composition: SnapshotComposition;
    if (account.kind === "investment") {
      composition = {
        holdings: (account.holdings ?? []).map((h) => ({
          ticker: h.ticker,
          quantity: h.quantity,
          // Same precedence as accountValue; `?? 0` for an unpriced holding so
          // the recorded composition still reconstructs the recorded value.
          price: h.priceOverride ?? priceFor(h.ticker) ?? 0,
        })),
      };
    } else {
      composition = { balance: account.balance ?? 0 };
    }

    snapshots.push({
      accountId: account.id,
      date,
      value: accountValue(account, priceFor),
      composition,
    });
  }

  return snapshots;
}

/**
 * The distinct tickers a check-in needs a feed price for: holdings in open
 * investment accounts that lack a manual override (an override needs no quote).
 * The action passes these to `getQuotes` so it fetches exactly what it must.
 */
export function tickersNeedingQuotes(accounts: Account[]): string[] {
  const tickers = new Set<string>();
  for (const account of accounts) {
    if (account.closedAt || account.kind !== "investment") continue;
    for (const h of account.holdings ?? []) {
      if (h.priceOverride === undefined) tickers.add(h.ticker);
    }
  }
  return [...tickers];
}

/**
 * The needed tickers a check-in could **not** get a price for: needed (see
 * {@link tickersNeedingQuotes}) but absent from the resolved `prices` map. This
 * only happens when a holding has no override, no cached price ever, and the
 * feed can't quote it — at which point recording the account would undershoot
 * its value and bake a wrong point into history (never reconstructed, ADR 0003).
 * The action refuses the check-in when this is non-empty and points the user at
 * a manual override (story 12) rather than silently recording $0.
 */
export function unpricedTickers(accounts: Account[], prices: Map<string, number>): string[] {
  return tickersNeedingQuotes(accounts).filter((ticker) => !prices.has(ticker));
}
