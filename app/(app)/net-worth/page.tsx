import type { Metadata } from "next";

import { AccountCard } from "@/components/net-worth/AccountCard";
import { AccountCardActions } from "@/components/net-worth/AccountCardActions";
import { AddAccountButton } from "@/components/net-worth/AddAccountButton";
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

  // Nothing set up yet — walk the user into their first account (story 17). The
  // Add button is role-gated (absent for viewers, who just read the copy).
  if (accounts.length === 0) {
    return (
      <div className="mx-auto w-full max-w-5xl px-6 py-10 pb-[calc(9rem+env(safe-area-inset-bottom))] md:pb-28">
        <NetWorthEmptyState action={<AddAccountButton variant="cta" />} />
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
  // An account with any snapshot has history — it can be closed but not deleted,
  // and its class is locked. Drives the edit sheet's affordances.
  const accountsWithHistory = new Set(snapshots.map((s) => s.accountId));

  const toGroup = (key: string, label: string, accts: Account[]) => {
    const items = accts.map((account) => ({ account, value: accountValue(account, priceFor) }));
    return { key, label, items, subtotal: items.reduce((sum, it) => sum + it.value, 0) };
  };

  const groups = GROUPS.map((group) =>
    toGroup(group.key, group.label, openAccounts.filter(group.match)),
  ).filter((group) => group.items.length > 0);

  // Safety net: an open account matching no group (e.g. a legacy or mis-shaped
  // asset with no kind) still counts in `netWorthHeadline`, so surface it as an
  // "Other" card rather than letting it vanish — otherwise the visible subtotals
  // wouldn't reconcile with the net figure. Can't happen for data that passed
  // `assertValidAccountShape`, but this keeps a bad record honest instead of hidden.
  const unclassified = openAccounts.filter((account) => !GROUPS.some((group) => group.match(account)));
  if (unclassified.length > 0) groups.push(toGroup("other", "Other", unclassified));

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-10 pb-[calc(9rem+env(safe-area-inset-bottom))] md:pb-28">
      <div className="flex items-start justify-between gap-4">
        <NetWorthHero headline={headline} />
        <AddAccountButton />
      </div>
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
                    action={
                      <AccountCardActions
                        account={account}
                        hasHistory={accountsWithHistory.has(account.id)}
                      />
                    }
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
