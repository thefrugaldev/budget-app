"use client";

import { Dialog } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import { useState, useTransition } from "react";

import { submitCheckInAction } from "@/app/actions/net-worth";
import { AccountIcon } from "@/components/net-worth/AccountIcon";
import { useHydrated } from "@/hooks/useHydrated";
import { useNotify } from "@/hooks/useNotify";
import { fmt, longDateLabel, monthLabel } from "@/lib/budget";
import { localTodayIso } from "@/lib/net-worth/local-today";
import { accountValue, netWorthHeadline } from "@/lib/net-worth/valuation";
import { cn } from "@/lib/utils";
import type { Account, AssetKind, PriceLookup } from "@/types/net-worth";

const TYPE_LABEL: Record<AssetKind | "liability", string> = {
  cash: "Cash",
  investment: "Investments",
  property: "Property",
  liability: "Liability",
};

function typeLabel(account: Account): string {
  return account.class === "liability" ? "Liability" : TYPE_LABEL[account.kind ?? "cash"];
}

/**
 * The monthly record step (#109 chunk 8, stories 7/8/22): a one-screen **review
 * and record**, not an editor. Account values are edited individually on the
 * page (the single source of truth); this stamps the current figures into
 * history as one dated point. Read-only by design — that removes the "which
 * value wins?" ambiguity of editing balances in two places.
 *
 * A11y: a focus-trapped dialog (Base UI) with a titled/described purpose; the
 * outcome is announced via the toast layer. Investment values are live-priced;
 * an unpriceable holding makes the server refuse the record (chunk 5 guard),
 * surfaced inline here.
 */
export function CheckInSheet({
  open,
  onOpenChange,
  accounts,
  prices,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  accounts: Account[];
  prices: Record<string, number>;
}) {
  const notify = useNotify();
  const today = useHydrated() ? localTodayIso() : "";
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const priceFor: PriceLookup = (ticker) => prices[ticker];
  const net = netWorthHeadline(accounts, priceFor).net;

  function handleRecord() {
    setError(null);
    startTransition(async () => {
      const res = await submitCheckInAction({ date: today || undefined });
      if (res.error) {
        setError(res.error);
        return;
      }
      // Confirm the month it's filed under (matches the chart's monthly point),
      // not the day-grain storage date — re-recording reads as "updated July".
      notify.success(
        today ? `Recorded your net worth for ${monthLabel(today.slice(0, 7))}` : "Net worth recorded",
      );
      onOpenChange(false);
    });
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 transition-opacity" />
        <Dialog.Popup
          aria-modal="true"
          className={cn(
            "fixed z-50 flex flex-col bg-card shadow-xl ring-1 ring-border outline-none",
            "inset-0",
            "md:inset-y-0 md:right-0 md:left-auto md:w-[480px] md:rounded-l-2xl",
            "data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 transition-[opacity,transform]",
            "md:data-[ending-style]:translate-x-full md:data-[starting-style]:translate-x-full md:data-[ending-style]:opacity-100 md:data-[starting-style]:opacity-100",
          )}
        >
          <header className="flex items-start justify-between gap-2 border-b border-border px-5 py-4">
            <div>
              <Dialog.Title className="font-heading text-lg font-semibold">
                Record this month
              </Dialog.Title>
              <Dialog.Description className="mt-0.5 text-xs text-muted-foreground">
                Saves today&rsquo;s values as a point on your trajectory
                {today && ` — ${longDateLabel(today)}`}.
              </Dialog.Description>
            </div>
            <Dialog.Close
              aria-label="Close"
              className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X className="size-4" aria-hidden />
            </Dialog.Close>
          </header>

          <div className="flex-1 overflow-y-auto px-5 py-4">
            <div className="mb-4 rounded-xl bg-muted px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Net worth to record
              </p>
              <p className="font-heading text-2xl font-bold tabular-nums">{fmt(net)}</p>
            </div>

            <ul className="divide-y divide-border">
              {accounts.map((account) => {
                const value = accountValue(account, priceFor);
                const isLiability = account.class === "liability";
                return (
                  <li key={account.id} className="flex items-center gap-3 py-2.5">
                    <AccountIcon account={account} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium leading-tight">{account.name}</p>
                      <span className="text-xs text-muted-foreground">{typeLabel(account)}</span>
                    </div>
                    <span
                      className={cn(
                        "shrink-0 text-sm font-medium tabular-nums",
                        isLiability ? "text-signal-bad-foreground" : "text-foreground",
                      )}
                    >
                      {fmt(isLiability ? -value : value)}
                    </span>
                  </li>
                );
              })}
            </ul>

            <p className="mt-4 text-xs text-muted-foreground">
              Every open account is recorded, even ones you didn&rsquo;t change. To adjust a value,
              edit the account on the page first, then record.
            </p>
          </div>

          {error && (
            <p role="alert" className="border-t border-border bg-destructive/10 px-5 py-2 text-xs text-destructive">
              {error}
            </p>
          )}

          <footer className="flex items-center justify-end gap-2 border-t border-border px-5 py-3">
            <Dialog.Close className="rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground">
              Cancel
            </Dialog.Close>
            <button
              type="button"
              onClick={handleRecord}
              disabled={pending}
              className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/80 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {pending ? "Recording…" : "Record"}
            </button>
          </footer>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
