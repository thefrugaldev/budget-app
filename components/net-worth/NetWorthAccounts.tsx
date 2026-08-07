"use client";

import { AccountCard } from "@/components/net-worth/AccountCard";
import { AccountCardActions } from "@/components/net-worth/AccountCardActions";
import { AccountRow } from "@/components/net-worth/AccountRow";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { ViewToggle } from "@/components/ui/ViewToggle";
import { useViewPreference } from "@/hooks/useViewPreference";
import { fmt } from "@/lib/budget";
import { accountValue, unpricedHoldingCount } from "@/lib/net-worth/valuation";
import type {
  Account,
  AccountItemView,
  NetWorthSection,
  PriceLookup,
} from "@/types/net-worth";
import type { ViewPreference } from "@/types/view";

/**
 * The Net Worth accounts region as an interactive client surface (#203): a
 * shared {@link ViewToggle} plus the Assets/Liabilities sections rendered as
 * either the card grid or a dense list, driven by one shared
 * {@link useViewPreference}. The server hands down already-grouped, serializable
 * sections (grouping and subtotals unchanged — this is presentational only), so
 * card and list draw from the same figures via the same `accountValue`
 * derivation, never a parallel path.
 *
 * `initialView` came from the cookie the server read at request time, so the
 * first paint is already in the chosen view — the toggle just switches it
 * thereafter (story 3). The toggle is a read affordance for everyone; the
 * per-item edit pencil (`AccountCardActions`) stays role-gated exactly as in the
 * card grid, so viewers see neither layout's edit control (story 6).
 */
export function NetWorthAccounts({
  sections,
  prices,
  institutions,
  accountsWithHistory,
  lastUpdated,
  initialView,
}: {
  sections: NetWorthSection[];
  /** Resolved live prices (ticker → price) for values and the edit sheet. */
  prices: Record<string, number>;
  institutions: string[];
  /** Ids of accounts that have at least one snapshot (locks class, hides delete). */
  accountsWithHistory: string[];
  /** Account id → ISO date of its most recent snapshot. */
  lastUpdated: Record<string, string>;
  initialView: ViewPreference;
}) {
  const { view, setView } = useViewPreference(initialView);
  const priceFor: PriceLookup = (ticker) => prices[ticker];
  const historyIds = new Set(accountsWithHistory);

  const itemFor = (account: Account): AccountItemView => ({
    account,
    value: accountValue(account, priceFor),
    lastUpdated: lastUpdated[account.id],
    unpricedCount: unpricedHoldingCount(account, priceFor),
  });

  const actionFor = (account: Account) => (
    <AccountCardActions
      account={account}
      hasHistory={historyIds.has(account.id)}
      institutions={institutions}
      prices={prices}
    />
  );

  return (
    <div>
      <div className="mb-4 flex items-center justify-end">
        <ViewToggle view={view} onChange={setView} label="Accounts view" />
      </div>

      <div className="space-y-8">
        {sections.map((section) => (
          <section key={section.key}>
            <SectionHeading
              variant="divider"
              amount={fmt(section.isLiability ? -section.total : section.total)}
            >
              {section.label}
            </SectionHeading>
            <div className="space-y-5">
              {section.groups.map((group) => {
                // Strict `=== null` for the bucket, so a real institution that
                // happens to net $0 is never mislabeled "No institution".
                const label =
                  group.institution === null ? "No institution" : group.institution;
                return (
                  <div key={group.institution ?? "__none__"}>
                    {/* Quiet, muted sub-label beneath the dominant section
                        divider — the section (h2) outranks its institution
                        groups (h3) rather than competing with them. */}
                    <div className="mb-2 flex items-baseline justify-between gap-3">
                      <h3 className="min-w-0 truncate text-xs font-medium text-muted-foreground">
                        {label}
                      </h3>
                      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                        {fmt(section.isLiability ? -group.subtotal : group.subtotal)}
                      </span>
                    </div>
                    {view === "card" ? (
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {group.accounts.map((account) => {
                          const item = itemFor(account);
                          return (
                            <AccountCard
                              key={account.id}
                              {...item}
                              action={actionFor(account)}
                            />
                          );
                        })}
                      </div>
                    ) : (
                      <ul className="divide-y divide-border overflow-hidden rounded-xl bg-card ring-1 ring-border">
                        {group.accounts.map((account) => {
                          const item = itemFor(account);
                          return (
                            <AccountRow
                              key={account.id}
                              {...item}
                              action={actionFor(account)}
                            />
                          );
                        })}
                      </ul>
                    )}
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
