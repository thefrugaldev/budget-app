"use client";

import { AlertDialog } from "@base-ui/react/alert-dialog";
import { Dialog } from "@base-ui/react/dialog";
import { FolderInput, Pencil, Trash2, X } from "lucide-react";
import { useState } from "react";

import { CategoryPicker } from "@/components/budget/CategoryPicker";
import { SignedAmount } from "@/components/budget/SignedAmount";
import { fmtExact } from "@/lib/budget";
import type { Category, CategoryKind } from "@/types/budget";

type OpenDialog = "none" | "delete" | "recategorise" | "rename";

/**
 * Contextual bulk-action bar for the transaction list (issue #17 chunk 4,
 * stories 10–16). Renders only when ≥ 1 row is selected; floats fixed at the
 * bottom of the viewport on every breakpoint, lifted clear of the mobile
 * bottom-tab (`z-30`, ~56px + safe-area) and padded for the iOS home
 * indicator. Always shows the count + the signed total of the selection.
 *
 * The bar owns its three confirm/picker surfaces but none of the persistence:
 * Delete (after a count + total confirm) calls `onDelete`, which drives the
 * optimistic-hide + undo machine up in `TransactionList`; Recategorise and
 * Rename call their handlers and surface success/error via the existing toast.
 * `pending` disables the controls while a recategorise/rename round-trips.
 */
export function BulkActionBar({
  count,
  total,
  kind,
  defaultVendor,
  categories,
  pending,
  onDelete,
  onRecategorise,
  onRename,
  onCancel,
}: {
  count: number;
  total: number;
  kind: CategoryKind;
  /** Most-common vendor in the selection — prefills the rename input (story 14). */
  defaultVendor: string | undefined;
  categories: Category[];
  pending: boolean;
  onDelete: () => void;
  onRecategorise: (categoryId: string) => void;
  onRename: (vendor: string) => void;
  onCancel: () => void;
}) {
  const [dialog, setDialog] = useState<OpenDialog>("none");
  const noun = count === 1 ? "transaction" : "transactions";

  return (
    <>
      {/* role=region + label so a screen reader announces the bar when it
          appears and selection count changes (story 22). aria-live=polite
          reports the count without stealing focus. */}
      <div
        role="region"
        aria-label="Bulk actions"
        className="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-40 flex justify-center px-4 md:bottom-6"
      >
        <div className="flex w-full max-w-2xl items-center gap-2 rounded-2xl bg-card px-3 py-2 shadow-xl ring-1 ring-border">
          <p className="flex min-w-0 flex-1 items-baseline gap-1.5 text-sm" aria-live="polite">
            <span className="font-medium tabular-nums">{count} selected</span>
            <span className="text-muted-foreground">·</span>
            <span className="truncate tabular-nums text-muted-foreground">
              <SignedAmount kind={kind} amount={total} marker={false} />
            </span>
          </p>

          <BarButton
            onClick={() => setDialog("recategorise")}
            disabled={pending}
            icon={<FolderInput className="size-4" aria-hidden />}
            label="Recategorise"
          />
          <BarButton
            onClick={() => setDialog("rename")}
            disabled={pending}
            icon={<Pencil className="size-4" aria-hidden />}
            label="Rename vendor"
          />
          <BarButton
            onClick={() => setDialog("delete")}
            disabled={pending}
            icon={<Trash2 className="size-4" aria-hidden />}
            label="Delete"
            destructive
          />
          <button
            type="button"
            onClick={onCancel}
            className="ml-1 inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="size-4" aria-hidden />
            <span className="sr-only sm:not-sr-only">Cancel</span>
          </button>
        </div>
      </div>

      <DeleteConfirm
        open={dialog === "delete"}
        onOpenChange={(open) => !open && setDialog("none")}
        count={count}
        total={total}
        noun={noun}
        onConfirm={() => {
          setDialog("none");
          onDelete();
        }}
      />

      <RecategoriseDialog
        open={dialog === "recategorise"}
        onOpenChange={(open) => !open && setDialog("none")}
        count={count}
        noun={noun}
        categories={categories}
        onPick={(categoryId) => {
          setDialog("none");
          onRecategorise(categoryId);
        }}
      />

      <RenameDialog
        open={dialog === "rename"}
        onOpenChange={(open) => !open && setDialog("none")}
        count={count}
        noun={noun}
        defaultVendor={defaultVendor}
        onSubmit={(vendor) => {
          setDialog("none");
          onRename(vendor);
        }}
      />
    </>
  );
}

function BarButton({
  onClick,
  disabled,
  icon,
  label,
  destructive = false,
}: {
  onClick: () => void;
  disabled: boolean;
  icon: React.ReactNode;
  label: string;
  destructive?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      // The label collapses to an icon-only button below `sm` so all four
      // actions fit the bar on a narrow phone; the accessible name is kept.
      title={label}
      className={
        "inline-flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1.5 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 " +
        (destructive
          ? "text-rose-700 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950"
          : "text-foreground hover:bg-muted")
      }
    >
      {icon}
      <span className="sr-only md:not-sr-only">{label}</span>
    </button>
  );
}

const BACKDROP =
  "fixed inset-0 z-40 bg-black/40 backdrop-blur-sm data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 transition-opacity";
const POPUP =
  "fixed left-1/2 top-1/2 z-50 w-[min(440px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-card p-6 shadow-xl ring-1 ring-border outline-none data-[ending-style]:opacity-0 data-[ending-style]:scale-95 data-[starting-style]:opacity-0 data-[starting-style]:scale-95 transition-[opacity,transform]";

/**
 * Destructive confirm that names the count *and* total (story 11) so a misclick
 * can't silently wipe a batch. Uses AlertDialog (role=alertdialog) — the focus
 * lands on Cancel by default, and the action is still reversible for ~5s after
 * via the undo toast that `onConfirm` kicks off.
 */
function DeleteConfirm({
  open,
  onOpenChange,
  count,
  total,
  noun,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  count: number;
  total: number;
  noun: string;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Portal>
        <AlertDialog.Backdrop className={BACKDROP} />
        <AlertDialog.Popup className={POPUP}>
          <AlertDialog.Title className="font-heading text-lg font-semibold">
            Delete {count} {noun}?
          </AlertDialog.Title>
          <AlertDialog.Description className="mt-1 text-sm text-muted-foreground">
            This removes {count} {noun} totalling{" "}
            <span className="font-medium text-foreground tabular-nums">
              {fmtExact(total)}
            </span>
            . You&rsquo;ll have a few seconds to undo.
          </AlertDialog.Description>
          <div className="mt-5 flex justify-end gap-2">
            <AlertDialog.Close className="rounded-md px-3 py-2 text-sm font-medium text-foreground ring-1 ring-border hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              Cancel
            </AlertDialog.Close>
            <button
              type="button"
              onClick={onConfirm}
              className="rounded-md bg-rose-600 px-3 py-2 text-sm font-medium text-white hover:bg-rose-600/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Delete {count} {noun}
            </button>
          </div>
        </AlertDialog.Popup>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}

/**
 * Bulk recategorise (stories 13/20). Reuses the same `CategoryPicker` the
 * Add/Edit form uses; picking a category fires immediately and closes — the
 * common cleanup gesture is "move this batch", so no separate confirm step.
 */
function RecategoriseDialog({
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

/**
 * Bulk vendor rename (story 14). The input is prefilled with the most-common
 * vendor in the selection so the common "fix a typo across many rows" case is
 * one keystroke from done. Submitting writes the new vendor to every selected
 * row.
 */
function RenameDialog({
  open,
  onOpenChange,
  count,
  noun,
  defaultVendor,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  count: number;
  noun: string;
  defaultVendor: string | undefined;
  onSubmit: (vendor: string) => void;
}) {
  const [value, setValue] = useState("");

  // Prefill (or refresh) the field each time the dialog opens. `open` is driven
  // by parent state rather than a Dialog.Trigger, so Base UI never fires
  // onOpenChange(true); seeding the value on the open-edge during render (the
  // React-sanctioned "adjust state when a prop changes" pattern) is what makes
  // the most-common vendor land in the input reliably.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setValue(defaultVendor ?? "");
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className={BACKDROP} />
        <Dialog.Popup className={POPUP}>
          <Dialog.Title className="font-heading text-lg font-semibold">
            Rename vendor on {count} {noun}
          </Dialog.Title>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const trimmed = value.trim();
              if (trimmed) onSubmit(trimmed);
            }}
            className="mt-4 space-y-4"
          >
            <label className="block space-y-1">
              <span className="block text-xs font-medium text-muted-foreground">
                New vendor name
              </span>
              <input
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="e.g. Whole Foods Market"
                autoFocus
                className="w-full rounded-md bg-background px-2 py-1.5 text-sm ring-1 ring-border outline-none focus:ring-ring"
              />
            </label>
            <div className="flex justify-end gap-2">
              <Dialog.Close className="rounded-md px-3 py-2 text-sm font-medium text-foreground ring-1 ring-border hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                Cancel
              </Dialog.Close>
              <button
                type="submit"
                disabled={value.trim() === ""}
                className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
              >
                Rename
              </button>
            </div>
          </form>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
