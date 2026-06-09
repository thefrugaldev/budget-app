"use client";

import { Dialog } from "@base-ui/react/dialog";
import { Plus } from "lucide-react";
import { useState } from "react";

import { CategoryForm } from "@/components/budget/CategoryForm";
import { cn } from "@/lib/utils";
import type { CategoryKind } from "@/types/budget";

const TITLES: Record<CategoryKind, string> = {
  expense: "Add expense category",
  savings: "Add savings category",
  income: "Add income source",
};

export function AddCategoryDialog({
  open,
  onOpenChange,
  presetKind,
  allowedKinds,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  presetKind?: CategoryKind;
  allowedKinds?: readonly CategoryKind[];
}) {
  const title = presetKind ? TITLES[presetKind] : "Add category";
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 transition-opacity" />
        <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 w-[min(440px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-card p-6 shadow-xl ring-1 ring-border outline-none data-[ending-style]:opacity-0 data-[ending-style]:scale-95 data-[starting-style]:opacity-0 data-[starting-style]:scale-95 transition-[opacity,transform]">
          <Dialog.Title className="font-heading text-lg font-semibold">
            {title}
          </Dialog.Title>
          <Dialog.Description className="mt-1 text-xs text-muted-foreground">
            New categories start with an initial monthly target you can revise
            later.
          </Dialog.Description>
          <div className="mt-4">
            <CategoryForm
              presetKind={presetKind}
              allowedKinds={allowedKinds}
              onSuccess={() => onOpenChange(false)}
            />
          </div>
          <div className="mt-4 flex justify-end">
            <Dialog.Close className="rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground">
              Cancel
            </Dialog.Close>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/**
 * Card-shaped "Add" tile rendered at the end of each section's card grid.
 * Kind is preset by the section it lives in (story 58); kind picker is
 * collapsed inside the dialog because there's nothing to choose.
 */
export function AddCategoryTile({ kind }: { kind: CategoryKind }) {
  const [open, setOpen] = useState(false);
  const label =
    kind === "expense"
      ? "Add expense category"
      : kind === "savings"
        ? "Add savings category"
        : "Add income source";
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "group flex min-h-[140px] cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border bg-transparent p-5 text-muted-foreground transition-colors",
          "hover:border-foreground/30 hover:bg-card hover:text-foreground",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        )}
      >
        <span
          aria-hidden
          className="grid size-10 place-items-center rounded-full bg-muted text-muted-foreground group-hover:text-foreground"
        >
          <Plus className="size-5" />
        </span>
        <span className="text-sm font-medium">{label}</span>
      </button>
      <AddCategoryDialog
        open={open}
        onOpenChange={setOpen}
        presetKind={kind}
      />
    </>
  );
}
