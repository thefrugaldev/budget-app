import { AddHoldingForm } from "@/components/net-worth/AddHoldingForm";
import { HoldingRow } from "@/components/net-worth/HoldingRow";
import type { Account } from "@/types/net-worth";

/**
 * The holdings section of an investment account's edit sheet (#109 chunk 7,
 * stories 4/12/18): the current positions with per-row edit/remove, plus an add
 * form. Each mutation is its own discrete action (not part of the details save),
 * mirroring how the category target history rows manage themselves.
 */
export function HoldingsEditor({ account }: { account: Account }) {
  const holdings = account.holdings ?? [];

  return (
    <section className="space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Holdings
      </p>

      {holdings.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No holdings yet — add the positions this account contains.
        </p>
      ) : (
        <div className="divide-y divide-border text-sm">
          {holdings.map((holding) => (
            <HoldingRow key={holding.ticker} accountId={account.id} holding={holding} />
          ))}
        </div>
      )}

      <AddHoldingForm accountId={account.id} />
    </section>
  );
}
