"use client";

import { Dialog } from "@base-ui/react/dialog";
import { Menu } from "@base-ui/react/menu";
import { Plus, Receipt, Wallet } from "lucide-react";
import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

import { createIncomeSourceAction } from "@/app/actions/income";
import { INCOME_ACTION_INITIAL } from "@/app/actions/income-state";
import { AddCategoryDialog } from "@/components/budget/AddCategoryDialog";
import { TransactionForm } from "@/components/budget/TransactionForm";
import { useNotify } from "@/components/notify";
import { cn } from "@/lib/utils";
import type { Category, Transaction } from "@/types/budget";

type Sheet = "transaction" | "category" | "income" | null;

/**
 * Bottom-right floating "+" — a popover menu (Base UI `<Menu>`) per the
 * "popover, not radial speed-dial" decision (story 15). Three options:
 *
 * - Add transaction → full TransactionForm dialog with the standalone category
 *   picker step (story 29).
 * - Add category → category-form dialog with a kind picker restricted to
 *   expense / savings (story 59). Income has its own dedicated entry below
 *   so the picker doesn't include it — that'd be a confusing duplicate.
 * - Add income source → small dialog wrapping `createIncomeSourceAction`
 *   (story 56). Mirrors the "+ Add another income source" path inside the
 *   header pencil's modal, but reachable from anywhere on the page.
 */
export function AddMenu({
  categories,
  transactions,
}: {
  categories: Category[];
  transactions: Transaction[];
}) {
  const [sheet, setSheet] = useState<Sheet>(null);

  return (
    <>
      <Menu.Root>
        <Menu.Trigger
          aria-label="Add"
          className="fixed bottom-8 right-8 z-10 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-base font-medium text-primary-foreground shadow-lg ring-1 ring-black/10 hover:bg-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Plus className="size-5" aria-hidden />
          <span>Add</span>
        </Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner sideOffset={8} align="end" className="z-30 outline-none">
            <Menu.Popup className="min-w-56 rounded-xl bg-card p-1 text-sm shadow-xl ring-1 ring-border outline-none">
              <Menu.Item
                onClick={() => setSheet("transaction")}
                className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 outline-none data-[highlighted]:bg-muted"
              >
                <Receipt className="size-4 text-muted-foreground" aria-hidden />
                <span>Add transaction</span>
              </Menu.Item>
              <Menu.Item
                onClick={() => setSheet("category")}
                className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 outline-none data-[highlighted]:bg-muted"
              >
                <Plus className="size-4 text-muted-foreground" aria-hidden />
                <span>Add category</span>
              </Menu.Item>
              <Menu.Item
                onClick={() => setSheet("income")}
                className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 outline-none data-[highlighted]:bg-muted"
              >
                <Wallet className="size-4 text-muted-foreground" aria-hidden />
                <span>Add income source</span>
              </Menu.Item>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>

      <AddTransactionDialog
        open={sheet === "transaction"}
        onOpenChange={(open) => setSheet(open ? "transaction" : null)}
        categories={categories}
        transactions={transactions}
      />
      <AddCategoryDialog
        open={sheet === "category"}
        onOpenChange={(open) => setSheet(open ? "category" : null)}
        allowedKinds={["expense", "savings"] as const}
      />
      <AddIncomeSourceDialog
        open={sheet === "income"}
        onOpenChange={(open) => setSheet(open ? "income" : null)}
      />
    </>
  );
}

function AddTransactionDialog({
  open,
  onOpenChange,
  categories,
  transactions,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  categories: Category[];
  transactions: Transaction[];
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 transition-opacity" />
        <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 w-[min(480px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-card p-6 shadow-xl ring-1 ring-border outline-none data-[ending-style]:opacity-0 data-[ending-style]:scale-95 data-[starting-style]:opacity-0 data-[starting-style]:scale-95 transition-[opacity,transform]">
          <Dialog.Title className="font-heading text-lg font-semibold">
            Add transaction
          </Dialog.Title>
          <Dialog.Description className="mt-1 text-xs text-muted-foreground">
            Pick a category, then enter the details. Refunds & withdrawals use
            the sign toggle.
          </Dialog.Description>
          <div className="mt-4">
            <TransactionForm
              categories={categories}
              transactions={transactions}
              onSuccess={() => onOpenChange(false)}
            />
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function AddIncomeSourceDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
}) {
  const [state, formAction] = useActionState(
    createIncomeSourceAction,
    INCOME_ACTION_INITIAL,
  );
  const notify = useNotify();
  const lastOk = useRef(state.ok);
  useEffect(() => {
    if (!open) lastOk.current = state.ok; // resync when dialog reopens
    else if (state.ok > lastOk.current && !state.error) {
      lastOk.current = state.ok;
      notify.success("Income source added");
      onOpenChange(false);
    }
  }, [open, state, onOpenChange, notify]);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 transition-opacity" />
        <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 w-[min(420px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-card p-6 shadow-xl ring-1 ring-border outline-none data-[ending-style]:opacity-0 data-[ending-style]:scale-95 data-[starting-style]:opacity-0 data-[starting-style]:scale-95 transition-[opacity,transform]">
          <Dialog.Title className="font-heading text-lg font-semibold">
            Add income source
          </Dialog.Title>
          <Dialog.Description className="mt-1 text-xs text-muted-foreground">
            New sources start today with their initial baseline.
          </Dialog.Description>
          <form action={formAction} className="mt-4 space-y-3">
            <div className="grid grid-cols-[64px_1fr] gap-2">
              <input
                name="emoji"
                defaultValue="💰"
                maxLength={4}
                aria-label="Emoji"
                className="rounded-md bg-background px-2 py-1.5 text-center text-lg ring-1 ring-border outline-none focus:ring-ring"
              />
              <input
                name="name"
                placeholder="Side gig"
                required
                className="rounded-md bg-background px-2 py-1.5 text-sm ring-1 ring-border outline-none focus:ring-ring"
              />
            </div>
            <input
              name="yearly"
              type="number"
              step="0.01"
              min="0"
              inputMode="decimal"
              placeholder="$0/yr"
              required
              className="w-full rounded-md bg-background px-2 py-1.5 text-right text-sm tabular-nums ring-1 ring-border outline-none focus:ring-ring"
            />
            {state.error && (
              <p role="alert" className="text-xs text-destructive">
                {state.error}
              </p>
            )}
            <div className="flex items-center justify-end gap-2 pt-1">
              <Dialog.Close className="rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground">
                Cancel
              </Dialog.Close>
              <SubmitButton />
            </div>
          </form>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={cn(
        "rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/80 disabled:opacity-60",
      )}
    >
      {pending ? "Adding…" : "Add source"}
    </button>
  );
}
