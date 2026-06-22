import { Dialog } from "@base-ui/react/dialog";

import { CategoryPicker } from "@/components/budget/category/CategoryPicker";
import { MODAL_BACKDROP, MODAL_POPUP } from "@/components/ui/dialogClasses";
import type { Category } from "@/types/budget";

/**
 * Bulk recategorise (stories 13/20). Reuses the same `CategoryPicker` the
 * Add/Edit form uses; picking a same-kind category applies immediately (the
 * common "move this batch" cleanup needs no extra step). A cross-kind pick is
 * routed by `onPick` through `CrossKindConfirm` first.
 */
export function RecategoriseDialog({
  open,
  onOpenChange,
  count,
  noun,
  categories,
  onPick,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  count: number;
  noun: string;
  categories: Category[];
  onPick: (categoryId: string) => void;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className={MODAL_BACKDROP} />
        <Dialog.Popup className={MODAL_POPUP}>
          <Dialog.Title className="font-heading text-lg font-semibold">
            Move {count} {noun}
          </Dialog.Title>
          <Dialog.Description className="mt-1 text-xs text-muted-foreground">
            Pick the category to move the selected {noun} into.
          </Dialog.Description>
          <div className="mt-4">
            <CategoryPicker
              categories={categories}
              selectedId={undefined}
              onChange={onPick}
              label="Move to"
            />
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
