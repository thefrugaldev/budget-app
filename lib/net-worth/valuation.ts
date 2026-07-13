import type { Account, AccountClass, NetWorthHeadline, PriceLookup } from "@/types/net-worth";

/**
 * An account's own value — a class-agnostic magnitude in dollars. Investment
 * accounts are Σ(quantity × price) across their holdings; every other account
 * (cash, property, liability) carries a manual `balance`.
 *
 * A holding's price is its manual `priceOverride` when set, else the feed price
 * from `priceFor` (#109 story 12) — so an override wins over the feed, covering a
 * ticker the feed can't quote or quotes wrongly. A holding with neither an
 * override nor a resolvable feed price contributes 0: the math never invents a
 * price, and the UI surfaces the staleness instead (story 19).
 */
export function accountValue(account: Account, priceFor: PriceLookup): number {
  if (account.kind === "investment") {
    let sum = 0;
    for (const h of account.holdings ?? []) {
      const price = h.priceOverride ?? priceFor(h.ticker);
      if (price !== undefined) sum += h.quantity * price;
    }
    return sum;
  }
  return account.balance ?? 0;
}

/**
 * How many of an account's holdings have no usable price — neither a manual
 * `priceOverride` nor a resolvable feed price (the same override-then-feed rule
 * {@link accountValue} prices by, and the row's "No price yet" chip flags). Zero
 * for a non-investment account (no holdings). The Net Worth card uses it to hint
 * that some positions need a manual price before the account value is complete.
 */
export function unpricedHoldingCount(account: Account, priceFor: PriceLookup): number {
  let count = 0;
  for (const h of account.holdings ?? []) {
    if ((h.priceOverride ?? priceFor(h.ticker)) === undefined) count++;
  }
  return count;
}

/**
 * An account's signed contribution to net worth: assets add, liabilities
 * subtract. Kept separate from {@link accountValue} because both the live
 * headline and the recorded history series sign a magnitude the same way — one
 * source for "assets minus liabilities".
 */
export function signedContribution(accountClass: AccountClass, value: number): number {
  return accountClass === "liability" ? -value : value;
}

/**
 * The live net-worth headline at current prices: the asset subtotal, the
 * liability subtotal (a positive magnitude), and net = assets − liabilities.
 * Closed accounts are excluded — they leave the headline but keep their history
 * (ADR 0003 / story 16).
 */
export function netWorthHeadline(accounts: Account[], priceFor: PriceLookup): NetWorthHeadline {
  let assets = 0;
  let liabilities = 0;
  for (const account of accounts) {
    if (account.closedAt) continue;
    const value = accountValue(account, priceFor);
    if (account.class === "liability") liabilities += value;
    else assets += value;
  }
  return { assets, liabilities, net: assets - liabilities };
}

/**
 * Whether an account counts toward the nest egg **by kind** — a cash or
 * investment *asset*. Property and liabilities are excluded automatically, with
 * no per-account setting: a house isn't withdrawable, and debt payments already
 * sit in monthly expenses, so counting a mortgage here would double-count it
 * (ADR 0003).
 *
 * Deliberately does *not* consider `closedAt` — that's a *live-view* concern the
 * callers layer on. The live nest egg drops closed accounts; the recorded
 * history keeps them (they zero out via their closing snapshot, see
 * {@link ./series.nestEggHistorySeries}), so the eligibility test itself is
 * purely kind-based and shared by both.
 */
export function isNestEggAccount(account: Pick<Account, "class" | "kind">): boolean {
  return account.class === "asset" && (account.kind === "cash" || account.kind === "investment");
}

/**
 * The FIRE nest egg: the sum of open cash + investment asset accounts at current
 * prices (story 1). Closed accounts drop out of this live figure; eligibility by
 * kind is {@link isNestEggAccount}. Consumed by the FIRE page (#110).
 */
export function nestEgg(accounts: Account[], priceFor: PriceLookup): number {
  let sum = 0;
  for (const account of accounts) {
    if (account.closedAt) continue;
    if (!isNestEggAccount(account)) continue;
    sum += accountValue(account, priceFor);
  }
  return sum;
}
