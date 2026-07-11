"use client";

import { Dialog } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import { useState, useTransition } from "react";

import { submitCheckInAction } from "@/app/actions/net-worth";
import { AmountInput } from "@/components/budget/amount/AmountInput";
import { AccountIcon } from "@/components/net-worth/AccountIcon";
import { useHydrated } from "@/hooks/useHydrated";
import { useNotify } from "@/hooks/useNotify";
import { useResyncOnChange } from "@/hooks/useResyncOnChange";
import { fmt, longDateLabel } from "@/lib/budget";
import { localTodayIso } from "@/lib/net-worth/local-today";
import { accountValue } from "@/lib/net-worth/valuation";
import { cn } from "@/lib/utils";
import type { Account, AssetKind } from "@/types/net-worth";

const TYPE_LABEL: Record<AssetKind | "liability", string> = {
  cash: "Cash",
  investment: "Investments",
  property: "Property",
  liability: "Liability",
};

function typeLabel(account: Account): string {
  return account.class === "liability" ? "Liability" : TYPE_LABEL[account.kind ?? "cash"];
}

function initialBalances(accounts: Account[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const a of accounts) {
    if (a.kind === "investment") continue; // valued from prices, not edited here
    out[a.id] = a.balance != null ? String(a.balance) : "";
  }
  return out;
}

/**
 * The single-page check-in (#109 chunk 8, stories 7/8/22): one screen listing
 * every open account, editable in one pass, saved once. Cash / property /
 * liability accounts get an editable balance; investment accounts show their
 * live-priced value read-only (holdings are managed from the account card).
 * Save applies the balance edits and records the snapshot set in a single
 * `submitCheckInAction` call, dated to the user's local day.
 *
 * A11y: each balance field has a real `<label htmlFor>`, the sheet is a focus-
 * trapped dialog (Base UI), and the outcome is announced via the toast layer.
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
  const [balances, setBalances] = useState<Record<string, string>>(() => initialBalances(accounts));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Reset the inputs to the persisted balances whenever the sheet (re)opens or a
  // persisted balance changes, keyed by value so typing doesn't get clobbered.
  useResyncOnChange(
    `${open}|${accounts.map((a) => `${a.id}:${a.balance ?? ""}`).join(",")}`,
    () => setBalances(initialBalances(accounts)),
  );

  function handleSave() {
    setError(null);
    // Send only genuinely-changed, non-empty balances; a cleared field is left
    // as-is rather than silently zeroing an account.
    const edits = accounts
      .filter((a) => a.kind !== "investment")
      .filter((a) => {
        const original = a.balance != null ? String(a.balance) : "";
        const next = balances[a.id] ?? "";
        return next !== "" && next !== original;
      })
      .map((a) => ({ accountId: a.id, balance: balances[a.id] }));

    startTransition(async () => {
      const res = await submitCheckInAction({ date: today || undefined, balances: edits });
      if (res.error) {
        setError(res.error);
        return;
      }
      notify.success(`Checked in — ${res.recorded} account${res.recorded === 1 ? "" : "s"} recorded`);
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
              <Dialog.Title className="font-heading text-lg font-semibold">Check in</Dialog.Title>
              <Dialog.Description className="mt-0.5 text-xs text-muted-foreground">
                Update each balance, then save once{today && ` — recorded as of ${longDateLabel(today)}`}.
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
            <ul className="divide-y divide-border">
              {accounts.map((account) => {
                const isInvestment = account.kind === "investment";
                const inputId = `checkin-${account.id}`;
                return (
                  <li key={account.id} className="flex items-center gap-3 py-2.5">
                    <AccountIcon account={account} />
                    <div className="min-w-0 flex-1">
                      {isInvestment ? (
                        <p className="truncate font-medium leading-tight">{account.name}</p>
                      ) : (
                        <label htmlFor={inputId} className="block truncate font-medium leading-tight">
                          {account.name}
                        </label>
                      )}
                      <span className="text-xs text-muted-foreground">{typeLabel(account)}</span>
                    </div>
                    {isInvestment ? (
                      <div className="shrink-0 text-right">
                        <span className="text-sm font-medium tabular-nums">
                          {fmt(accountValue(account, (t) => prices[t]))}
                        </span>
                        <span className="block text-[10px] text-muted-foreground">Live price</span>
                      </div>
                    ) : (
                      <div className="w-32 shrink-0">
                        <AmountInput
                          id={inputId}
                          precision="cents"
                          variant="field"
                          value={balances[account.id] ?? ""}
                          onChange={(v) => setBalances((prev) => ({ ...prev, [account.id]: v }))}
                          ariaLabel={`${account.name} balance`}
                        />
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
            <p className="mt-4 text-xs text-muted-foreground">
              Investment values update automatically from live prices — manage their holdings from the
              account card. Every open account is recorded, even ones you didn&rsquo;t change.
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
              onClick={handleSave}
              disabled={pending}
              className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/80 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {pending ? "Saving…" : "Save check-in"}
            </button>
          </footer>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
