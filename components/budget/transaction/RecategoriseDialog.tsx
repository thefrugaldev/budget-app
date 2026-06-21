import { Dialog } from "@base-ui/react/dialog";

import { CategoryPicker } from "@/components/budget/category/CategoryPicker";
import type { Category } from "@/types/budget";

const BACKDROP =
  "fixed inset-0 z-40 bg-black/40 backdrop-blur-sm data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 transition-opacity";
const POPUP =
  "fixed left-1/2 top-1/2 z-50 w-[min(440px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-card p-6 shadow-xl ring-1 ring-border outline-none data-[ending-style]:opacity-0 data-[ending-style]:scale-95 data-[starting-style]:opacity-0 data-[starting-style]:scale-95 transition-[opacity,transform]";

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
        <Dialog.Backdrop className={BACKDROP} />
        <Dialog.Popup className={POPUP}>
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
