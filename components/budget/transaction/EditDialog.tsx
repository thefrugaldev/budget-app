import { Dialog } from "@base-ui/react/dialog";

import { TransactionForm } from "@/components/budget/transaction/TransactionForm";
import type { Category, Transaction } from "@/types/budget";

/**
 * Modal wrapper that hosts {@link TransactionForm} in edit mode for the row
 * selected from a `…` menu. Opens whenever `editing` is non-null; saving (or
 * dismissing) calls `onClose`.
 */
export function EditDialog({
  editing,
  onClose,
  categories,
  allTransactions,
}: {
  editing: Transaction | null;
  onClose: () => void;
  categories: Category[];
  allTransactions: Transaction[];
}) {
  return (
    <Dialog.Root open={editing !== null} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 transition-opacity" />
        <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 w-[min(480px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-card p-6 shadow-xl ring-1 ring-border outline-none data-[ending-style]:opacity-0 data-[ending-style]:scale-95 data-[starting-style]:opacity-0 data-[starting-style]:scale-95 transition-[opacity,transform]">
          <Dialog.Title className="font-heading text-lg font-semibold">
            Edit transaction
          </Dialog.Title>
          <Dialog.Description className="mt-1 text-xs text-muted-foreground">
            Change any field and save. Re-categorize via the category picker.
          </Dialog.Description>
          {editing && (
            <div className="mt-4">
              <TransactionForm
                categories={categories}
                transactions={allTransactions}
                editing={editing}
                onSuccess={onClose}
              />
            </div>
          )}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
