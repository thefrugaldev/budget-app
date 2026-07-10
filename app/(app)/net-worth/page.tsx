import type { Metadata } from "next";

import { AccountCard } from "@/components/net-worth/AccountCard";
import { NetWorthEmptyState } from "@/components/net-worth/NetWorthEmptyState";
import { NetWorthHero } from "@/components/net-worth/NetWorthHero";
import { PriceStalenessNotice } from "@/components/net-worth/PriceStalenessNotice";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { fmt } from "@/lib/budget";
import { tickersNeedingQuotes } from "@/lib/net-worth/check-in";
import { DEFAULT_QUOTE_TTL_MS, getQuotesWithAsOf } from "@/lib/net-worth/price/get-quotes";
import { pricingStatus } from "@/lib/net-worth/pricing-status";
import { latestSnapshotDates } from "@/lib/net-worth/series";
import { accountValue, netWorthHeadline } from "@/lib/net-worth/valuation";
import { listAccounts } from "@/lib/repositories/accounts";
import { listSnapshots } from "@/lib/repositories/snapshots";
import type { Account, PriceLookup } from "@/types/net-worth";

export const metadata: Metadata = {
  title: "Net worth",
};

// Asset kinds first (in a stable, cash→property order), liabilities last — the
// order the page groups account cards under (story 3/6/14). Investments sit
// between cash and property because they're the market-priced middle.
const GROUPS: { key: string; label: string; match: (a: Account) => boolean }[] = [
  { key: "cash", label: "Cash", match: (a) => a.class === "asset" && a.kind === "cash" },
  {
    key: "investment",
    label: "Investments",
    match: (a) => a.class === "asset" && a.kind === "investment",
  },
  { key: "property", label: "Property", match: (a) => a.class === "asset" && a.kind === "property" },
  { key: "liability", label: "Liabilities", match: (a) => a.class === "liability" },
];

export default async function NetWorthPage() {
  const [accounts, snapshots] = await Promise.all([listAccounts(), listSnapshots()]);

  // Nothing set up yet — walk the user into their first account (story 17).
  if (accounts.length === 0) {
    return (
      <div className="mx-auto w-full max-w-5xl px-6 py-10 pb-[calc(9rem+env(safe-area-inset-bottom))] md:pb-28">
        <NetWorthEmptyState />
      </div>
    );
  }

  // Closed accounts leave the live view (headline + cards) but keep their
  // history for the trajectory chart (chunk 9) — so the page reads open only.
  const openAccounts = accounts.filter((a) => !a.closedAt);

  // Resolve live prices once (cached, refreshed only when stale) and share the
  // lookup across the headline, per-card values, and subtotals so they agree.
  const tickers = tickersNeedingQuotes(openAccounts);
  const { prices, asOf } = await getQuotesWithAsOf(tickers);
  const priceFor: PriceLookup = (ticker) => prices.get(ticker);
  const status = pricingStatus({
    neededTickers: tickers,
    prices,
    asOf,
    now: new Date().toISOString(),
    ttlMs: DEFAULT_QUOTE_TTL_MS,
  });

  const headline = netWorthHeadline(openAccounts, priceFor);
  const lastUpdated = latestSnapshotDates(snapshots);

  const groups = GROUPS.map((group) => {
    const items = openAccounts
      .filter(group.match)
      .map((account) => ({ account, value: accountValue(account, priceFor) }));
    const subtotal = items.reduce((sum, it) => sum + it.value, 0);
    return { ...group, items, subtotal };
  }).filter((group) => group.items.length > 0);

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-10 pb-[calc(9rem+env(safe-area-inset-bottom))] md:pb-28">
      <NetWorthHero headline={headline} />
      <PriceStalenessNotice status={status} />

      <div className="space-y-8">
        {groups.map((group) => {
          const isLiability = group.key === "liability";
          return (
            <section key={group.key}>
              <SectionHeading amount={fmt(isLiability ? -group.subtotal : group.subtotal)}>
                {group.label}
              </SectionHeading>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {group.items.map(({ account, value }) => (
                  <AccountCard
                    key={account.id}
                    account={account}
                    value={value}
                    lastUpdated={lastUpdated.get(account.id)}
                  />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
