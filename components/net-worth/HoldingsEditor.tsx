"use client";

import { Plus } from "lucide-react";
import { useState } from "react";

import { AddHoldingForm } from "@/components/net-worth/AddHoldingForm";
import { HoldingRow } from "@/components/net-worth/HoldingRow";
import type { Account } from "@/types/net-worth";

/**
 * The holdings section of an investment account's edit sheet (#109 chunk 7,
 * stories 4/12/18). The current positions are the primary content — a clear
 * divided list showing each holding's value — and adding is a secondary,
 * opt-in action revealed by a button, so the add form no longer out-weighs the
 * data. Each mutation is its own discrete action (not part of the details save),
 * mirroring how the category target history rows manage themselves.
 *
 * `prices` is the resolved live-price lookup (ticker → price) from the page, so
 * each row can show its value and flag positions the feed can't price.
 */
export function HoldingsEditor({
  account,
  prices,
}: {
  account: Account;
  prices: Record<string, number>;
}) {
  const holdings = account.holdings ?? [];
  // Initial-only: open the add form when there's nothing to show, otherwise
  // start collapsed. Deliberately not synced afterward — once mounted, the
  // user's expand/collapse toggle wins.
  const [adding, setAdding] = useState(holdings.length === 0);

  return (
    <section className="space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Holdings
      </p>

      {holdings.length > 0 && (
        <div className="divide-y divide-border text-sm">
          {holdings.map((holding) => (
            <HoldingRow
              key={holding.ticker}
              accountId={account.id}
              holding={holding}
              feedPrice={prices[holding.ticker]}
            />
          ))}
        </div>
      )}

      {adding ? (
        <AddHoldingForm
          accountId={account.id}
          onCancel={holdings.length > 0 ? () => setAdding(false) : undefined}
        />
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium text-muted-foreground ring-1 ring-border hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Plus className="size-3.5" aria-hidden />
          Add holding
        </button>
      )}
    </section>
  );
}
