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
