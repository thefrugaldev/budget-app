"use client";

import { Dialog } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import { useActionState, useState } from "react";

import { updateAccountAction } from "@/app/actions/net-worth";
import { NET_WORTH_ACTION_INITIAL } from "@/app/actions/net-worth-state";
import { AccountFields } from "@/components/net-worth/AccountFields";
import { AccountLifecycleActions } from "@/components/net-worth/AccountLifecycleActions";
import { HoldingsEditor } from "@/components/net-worth/HoldingsEditor";
import { useActionSuccessToast } from "@/hooks/useActionSuccessToast";
import { cn } from "@/lib/utils";
import type { Account, AccountClass, AssetKind } from "@/types/net-worth";

/**
 * Edit an account (#109 chunk 7, stories 15/16/18). A right-side flyout (full
 * screen on mobile) mirroring `CategoryEditSheet`: a details form (name / type /
 * kind / balance) saved via chunk 5's `updateAccountAction`, the holdings editor
 * for an investment account, and the lifecycle actions (close / delete). Holdings
 * and lifecycle are discrete mutations, not part of the details save.
 *
 * `hasHistory` locks the class picker (the server refuses a class change once
 * snapshots exist) and hides Delete (a history-bearing account is closed, not
 * deleted). Controlled inputs resync when the persisted account changes — keyed
 * by value so an unrelated revalidation (e.g. adding a holding) doesn't clobber
 * an in-progress details edit.
 */
export function AccountEditSheet({
  account,
  hasHistory,
  prices,
  open,
  onOpenChange,
}: {
  account: Account;
  hasHistory: boolean;
  /** Resolved live prices (ticker → price) for the holdings editor's values. */
  prices: Record<string, number>;
  open: boolean;
  onOpenChange: (next: boolean) => void;
}) {
  const [name, setName] = useState(account.name);
  const [accountClass, setAccountClass] = useState<AccountClass>(account.class);
  const [kind, setKind] = useState<AssetKind>(account.kind ?? "cash");
  const [balance, setBalance] = useState(account.balance != null ? String(account.balance) : "");

  const accountKey = `${account.name}|${account.class}|${account.kind ?? ""}|${account.balance ?? ""}`;
  const [prev, setPrev] = useState({ key: accountKey, open });
  if (prev.key !== accountKey || (open && !prev.open)) {
    setPrev({ key: accountKey, open });
    setName(account.name);
    setAccountClass(account.class);
    setKind(account.kind ?? "cash");
    setBalance(account.balance != null ? String(account.balance) : "");
  } else if (prev.open !== open) {
    setPrev({ ...prev, open });
  }

  const [state, formAction, isPending] = useActionState(updateAccountAction, NET_WORTH_ACTION_INITIAL);
  // Saving the details commits the primary edit, so it resolves by closing the
  // sheet (the earlier silent stay-open read as "nothing happened"). Holdings
  // and lifecycle are incremental and keep the sheet open on their own.
  useActionSuccessToast(state, () => `${account.name} updated`, () => onOpenChange(false));

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
          <header className="flex items-center justify-between gap-2 border-b border-border px-5 py-4">
            <Dialog.Title className="font-heading text-lg font-semibold">
              Edit {account.name}
            </Dialog.Title>
            <Dialog.Close
              aria-label="Close"
              className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X className="size-4" aria-hidden />
            </Dialog.Close>
          </header>

          <div className="flex-1 overflow-y-auto px-5 py-4">
            <div className="space-y-5 text-sm">
              {/* The details form carries an id so the footer Save can submit it
                  from outside — it can't wrap the whole sheet, as the holdings
                  and lifecycle forms below would then be illegally nested. */}
              <form id="account-details-form" action={formAction} className="space-y-3">
                <input type="hidden" name="id" value={account.id} />
                <AccountFields
                  name={name}
                  onName={setName}
                  accountClass={accountClass}
                  onClass={setAccountClass}
                  kind={kind}
                  onKind={setKind}
                  balance={balance}
                  onBalance={setBalance}
                  classLocked={hasHistory}
                />
                {state.error && (
                  <p role="alert" className="text-xs text-destructive">
                    {state.error}
                  </p>
                )}
              </form>

              {/* Gate on the *persisted* kind, not the unsaved picker — holdings
                  belong to an account that is already an investment (the server
                  rejects holdings on anything else). Switch to investment and
                  save first, then the editor appears. */}
              {account.kind === "investment" && (
                <>
                  <hr className="border-border" />
                  <HoldingsEditor account={account} prices={prices} />
                </>
              )}

              <hr className="border-border" />
              <AccountLifecycleActions
                account={account}
                hasHistory={hasHistory}
                onDone={() => onOpenChange(false)}
              />
            </div>
          </div>

          <footer className="flex items-center justify-end gap-2 border-t border-border px-5 py-3">
            <Dialog.Close className="rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground">
              Close
            </Dialog.Close>
            <button
              type="submit"
              form="account-details-form"
              disabled={isPending}
              className="rounded-md bg-foreground px-3 py-1.5 text-sm font-medium text-background disabled:opacity-50"
            >
              {isPending ? "Saving…" : "Save changes"}
            </button>
          </footer>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
