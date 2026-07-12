import type { Metadata } from "next";
import Link from "next/link";

import { FireDashboard } from "@/components/fire/FireDashboard";
import { trailingActuals } from "@/lib/budget";
import { tickersNeedingQuotes } from "@/lib/net-worth/check-in";
import { getQuotesWithAsOf } from "@/lib/net-worth/price/get-quotes";
import { nestEgg } from "@/lib/net-worth/valuation";
import { getFireAssumptionOverrides } from "@/lib/repositories/fire-assumptions";
import { listAccounts } from "@/lib/repositories/accounts";
import { listCategories } from "@/lib/repositories/categories";
import { listAllTransactions } from "@/lib/repositories/transactions";
import type { PriceLookup } from "@/types/net-worth";

export const metadata: Metadata = {
  title: "FIRE",
};

const CONTAINER =
  "mx-auto w-full max-w-5xl px-6 py-10 pb-[calc(9rem+env(safe-area-inset-bottom))] md:pb-28";

export default async function FirePage() {
  const [accounts, categories, transactions, stored] = await Promise.all([
    listAccounts(),
    listCategories(),
    listAllTransactions(),
    getFireAssumptionOverrides(),
  ]);

  const openAccounts = accounts.filter((a) => !a.closedAt);
  // The nest egg is cash + investment assets (ADR 0003). With none of those, it's
  // $0 and the whole projection is meaningless, so point the user at Net Worth
  // first rather than show a 0%-forever dashboard (story 19).
  const hasNestEggAccounts = openAccounts.some(
    (a) => a.class === "asset" && (a.kind === "cash" || a.kind === "investment"),
  );

  if (!hasNestEggAccounts) {
    return (
      <div className={CONTAINER}>
        <header className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            FIRE
          </p>
          <h1 className="mt-2 font-heading text-display font-bold tracking-tight">
            When can you stop needing a paycheck?
          </h1>
        </header>
        <div className="rounded-lg bg-card p-6 ring-1 ring-border">
          <p className="text-base text-muted-foreground">
            FIRE projects your <span className="font-medium text-foreground">nest egg</span> — your
            cash and investment accounts — forward against your spending. Add a cash or investment
            account on Net Worth to get started.
          </p>
          <Link
            href="/net-worth"
            className="mt-5 inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Set up Net Worth
          </Link>
        </div>
      </div>
    );
  }

  // Resolve live prices once and value the nest egg from the same lookup the Net
  // Worth page uses, so the two pages agree on what the accounts are worth.
  const tickers = tickersNeedingQuotes(openAccounts);
  const { prices } = await getQuotesWithAsOf(tickers);
  const priceFor: PriceLookup = (ticker) => prices.get(ticker);
  const nestEggAmount = nestEgg(openAccounts, priceFor);

  const actuals = trailingActuals(transactions, categories);
  // Server-stable "now": the client anchors the projection to this exact value,
  // so SSR and hydration compute identical dates (no month-boundary mismatch).
  const nowIso = new Date().toISOString();

  return (
    <div className={CONTAINER}>
      <FireDashboard
        nestEgg={nestEggAmount}
        actuals={actuals}
        stored={stored}
        nowIso={nowIso}
      />
    </div>
  );
}
