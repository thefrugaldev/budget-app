"use client";

import { Menu } from "@base-ui/react/menu";
import { Plus, Receipt, Wallet } from "lucide-react";
import { useState } from "react";

import { AddCategoryDialog } from "@/components/budget/category/AddCategoryDialog";
import { AddIncomeSourceDialog } from "@/components/budget/income/AddIncomeSourceDialog";
import { AddTransactionDialog } from "@/components/budget/shared/AddTransactionDialog";
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
          /*
           * Mobile: the FAB clears the ~56px bottom-tab nav (`bottom-24` =
           * 96px leaves ~40px of breathing room above it) and an iOS
           * safe-area inset margin keeps it above the home indicator. The
           * Pulse page pads its bottom by FAB height + this clearance +
           * safe-area so the last card always scrolls clear of the FAB.
           */
          style={{ marginBottom: "env(safe-area-inset-bottom)" }}
          className="fixed bottom-24 right-4 z-10 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-base font-medium text-primary-foreground shadow-lg ring-1 ring-black/10 hover:bg-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:bottom-8 md:right-8"
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

