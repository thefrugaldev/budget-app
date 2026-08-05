import type { Metadata } from "next";

import { AccountCard } from "@/components/net-worth/AccountCard";
import { AccountCardActions } from "@/components/net-worth/AccountCardActions";
import { AddAccountButton } from "@/components/net-worth/AddAccountButton";
import { CheckInButton } from "@/components/net-worth/CheckInButton";
import { NetWorthEmptyState } from "@/components/net-worth/NetWorthEmptyState";
import { NetWorthHero } from "@/components/net-worth/NetWorthHero";
import { NetWorthTrajectory } from "@/components/net-worth/NetWorthTrajectory";
import { PriceStalenessNotice } from "@/components/net-worth/PriceStalenessNotice";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { fmt } from "@/lib/budget";
import { tickersNeedingQuotes } from "@/lib/net-worth/check-in";
import { DEFAULT_QUOTE_TTL_MS, getQuotesWithAsOf } from "@/lib/net-worth/price/get-quotes";
import { pricingStatus } from "@/lib/net-worth/pricing-status";
import { latestSnapshotDates, monthlyNetWorthSeries } from "@/lib/net-worth/series";
import { groupAccountsByInstitution } from "@/lib/net-worth/group-by-institution";
import { accountValue, netWorthHeadline, unpricedHoldingCount } from "@/lib/net-worth/valuation";
import { listAccounts, listInstitutions } from "@/lib/repositories/accounts";
import { listSnapshots } from "@/lib/repositories/snapshots";
import type { PriceLookup } from "@/types/net-worth";

export const metadata: Metadata = {
  title: "Net worth",
};

export default async function NetWorthPage() {
  const [accounts, snapshots, institutions] = await Promise.all([
    listAccounts(),
    listSnapshots(),
    listInstitutions(),
  ]);

  // Nothing set up yet — walk the user into their first account (story 17). The
  // Add button is role-gated (absent for viewers, who just read the copy).
  if (accounts.length === 0) {
    return (
      <div className="mx-auto w-full max-w-5xl px-6 py-10 pb-[calc(9rem+env(safe-area-inset-bottom))] md:pb-28">
        <NetWorthEmptyState action={<AddAccountButton institutions={institutions} variant="cta" />} />
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
  // Plain lookup for the client edit sheet's per-holding values (Map → Record).
  const priceByTicker = Object.fromEntries(prices);
  const status = pricingStatus({
    neededTickers: tickers,
    prices,
    asOf,
    now: new Date().toISOString(),
    ttlMs: DEFAULT_QUOTE_TTL_MS,
  });

  const headline = netWorthHeadline(openAccounts, priceFor);
  const lastUpdated = latestSnapshotDates(snapshots);
  // Recorded history for the trajectory chart (story 9). Built over *all*
  // accounts, not just open ones: a closed account's snapshots stay in the
  // series (its closing $0 keeps it flat rather than dropping it), so history
  // never silently rewrites itself (ADR 0003; story 16).
  const trajectory = monthlyNetWorthSeries(accounts, snapshots);
  // An account with any snapshot has history — it can be closed but not deleted,
  // and its class is locked. Drives the edit sheet's affordances.
  const accountsWithHistory = new Set(snapshots.map((s) => s.accountId));

  // Group each class's open accounts by institution (#195). The helper is
  // section-agnostic and doesn't drop closed accounts, so we hand it the same
  // open-only, single-class lists the headline sums — keeping each section's
  // institution subtotals reconciled with the headline figure. Assets and
  // liabilities stay separate sections (grouping is presentational; the math is
  // unchanged); the "No institution" group sorts last within each.
  const sections = [
    {
      key: "asset",
      label: "Assets",
      isLiability: false,
      total: headline.assets,
      groups: groupAccountsByInstitution(
        openAccounts.filter((account) => account.class === "asset"),
        priceFor,
      ),
    },
    {
      key: "liability",
      label: "Liabilities",
      isLiability: true,
      total: headline.liabilities,
      groups: groupAccountsByInstitution(
        openAccounts.filter((account) => account.class === "liability"),
        priceFor,
      ),
    },
  ].filter((section) => section.groups.length > 0);

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-10 pb-[calc(9rem+env(safe-area-inset-bottom))] md:pb-28">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <NetWorthHero headline={headline} />
        <div className="flex items-center gap-2">
          {openAccounts.length > 0 && (
            <CheckInButton accounts={openAccounts} prices={priceByTicker} />
          )}
          <AddAccountButton institutions={institutions} />
        </div>
      </div>
      <PriceStalenessNotice status={status} />

      {/* Recorded history — omitted until the first check-in exists, so a fresh
          setup isn't fronted by an empty chart (the check-in button is the cue). */}
      {trajectory.length > 0 && (
        <div className="mb-8">
          <NetWorthTrajectory series={trajectory} />
        </div>
      )}

      <div className="space-y-8">
        {sections.map((section) => (
          <section key={section.key}>
            <SectionHeading amount={fmt(section.isLiability ? -section.total : section.total)}>
              {section.label}
            </SectionHeading>
            <div className="space-y-5">
              {section.groups.map((group) => {
                // Strict `=== null` for the bucket, so a real institution that
                // happens to net $0 is never mislabeled "No institution".
                const label = group.institution === null ? "No institution" : group.institution;
                return (
                  <div key={group.institution ?? "__none__"}>
                    <div className="mb-2 flex items-baseline justify-between gap-3">
                      <h3 className="truncate text-sm font-medium text-foreground">{label}</h3>
                      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                        {fmt(section.isLiability ? -group.subtotal : group.subtotal)}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {group.accounts.map((account) => (
                        <AccountCard
                          key={account.id}
                          account={account}
                          value={accountValue(account, priceFor)}
                          lastUpdated={lastUpdated.get(account.id)}
                          unpricedCount={unpricedHoldingCount(account, priceFor)}
                          action={
                            <AccountCardActions
                              account={account}
                              hasHistory={accountsWithHistory.has(account.id)}
                              institutions={institutions}
                              prices={priceByTicker}
                            />
                          }
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
