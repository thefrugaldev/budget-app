"use client";

import { AlertDialog } from "@base-ui/react/alert-dialog";
import { Dialog } from "@base-ui/react/dialog";
import { AlertTriangle, FolderInput, Pencil, Trash2, X } from "lucide-react";
import { useState } from "react";

import { CategoryPicker } from "@/components/budget/CategoryPicker";
import { SignedAmount } from "@/components/budget/SignedAmount";
import { fmtExact } from "@/lib/budget";
import type { Category, CategoryKind } from "@/types/budget";

type OpenDialog =
  | "none"
  | "delete"
  | "recategorise"
  | "recategorise-confirm"
  | "rename";

const KIND_LABEL: Record<CategoryKind, string> = {
  expense: "expense",
  savings: "savings",
  income: "income",
};

/**
 * Contextual bulk-action bar for the transaction list (issue #17 chunk 4,
 * stories 10–16). Renders only when ≥ 1 row is selected; floats fixed at the
 * bottom of the viewport on every breakpoint, lifted clear of the mobile
 * bottom-tab (`z-30`, ~56px + safe-area) and padded for the iOS home
 * indicator. Always shows the count + the signed total of the selection.
 *
 * The bar owns its confirm/picker surfaces but none of the persistence:
 * Delete (after a count + total confirm) calls `onDelete`, which drives the
 * optimistic-hide + undo machine up in `TransactionList`; Recategorise and
 * Rename call their handlers and surface success/error via the existing toast.
 * A recategorise that crosses category kinds (e.g. expense → income) is gated
 * behind an extra confirm, since it re-weights the savings-rate maths.
 */
export function BulkActionBar({
  count,
  total,
  kind,
  defaultVendor,
  selectedVendors,
  categories,
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
  /**
   * Distinct vendors in the selection. More than one means a rename merges
   * them into a single value, so the rename dialog warns before overwriting.
   */
  selectedVendors: string[];
  categories: Category[];
  onDelete: () => void;
  onRecategorise: (categoryId: string) => void;
  onRename: (vendor: string) => void;
  onCancel: () => void;
}) {
  const [dialog, setDialog] = useState<OpenDialog>("none");
  // Target of a pending cross-kind recategorise, held while its confirm is up.
  const [crossKindTarget, setCrossKindTarget] = useState<Category | null>(null);
  const noun = count === 1 ? "transaction" : "transactions";

  // Same-kind moves apply immediately; a kind change (expense ↔ savings ↔
  // income) flips how the rows are counted, so it routes through a confirm.
  function pickCategory(categoryId: string) {
    const target = categories.find((c) => c.id === categoryId);
    if (target && target.kind !== kind) {
      setCrossKindTarget(target);
      setDialog("recategorise-confirm");
      return;
    }
    setDialog("none");
    onRecategorise(categoryId);
  }

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
            icon={<FolderInput className="size-4" aria-hidden />}
            label="Recategorise"
          />
          <BarButton
            onClick={() => setDialog("rename")}
            icon={<Pencil className="size-4" aria-hidden />}
            label="Rename vendor"
          />
          <BarButton
            onClick={() => setDialog("delete")}
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
        onPick={pickCategory}
      />

      <CrossKindConfirm
        open={dialog === "recategorise-confirm"}
        onOpenChange={(open) => !open && setDialog("none")}
        count={count}
        noun={noun}
        sourceKind={kind}
        target={crossKindTarget}
        onConfirm={() => {
          setDialog("none");
          if (crossKindTarget) onRecategorise(crossKindTarget.id);
        }}
      />

      <RenameDialog
        open={dialog === "rename"}
        onOpenChange={(open) => !open && setDialog("none")}
        count={count}
        noun={noun}
        defaultVendor={defaultVendor}
        selectedVendors={selectedVendors}
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
  icon,
  label,
  destructive = false,
}: {
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  destructive?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      // The label collapses to an icon-only button below `sm` so all four
      // actions fit the bar on a narrow phone; the accessible name is kept.
      title={label}
      className={
        "inline-flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1.5 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring " +
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
 * Add/Edit form uses; picking a same-kind category applies immediately (the
 * common "move this batch" cleanup needs no extra step). A cross-kind pick is
 * routed by `onPick` through `CrossKindConfirm` first.
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
 * Guards a recategorise that crosses category kinds (e.g. moving expenses into
 * a savings or income category). That flips how the rows are counted and
 * re-weights the savings-rate maths on Pulse, so — unlike a same-kind move —
 * it earns a confirm that names the consequence. The common case never sees
 * this dialog; it only fires on a kind change.
 */
function CrossKindConfirm({
  open,
  onOpenChange,
  count,
  noun,
  sourceKind,
  target,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  count: number;
  noun: string;
  sourceKind: CategoryKind;
  target: Category | null;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Portal>
        <AlertDialog.Backdrop className={BACKDROP} />
        <AlertDialog.Popup className={POPUP}>
          <AlertDialog.Title className="font-heading text-lg font-semibold">
            Move into {target ? `${target.emoji} ${target.name}` : "another category"}?
          </AlertDialog.Title>
          <AlertDialog.Description className="mt-1 text-sm text-muted-foreground">
            {target
              ? `${target.name} is ${target.kind === "income" ? "an" : "a"} ` +
                `${KIND_LABEL[target.kind]} category. Moving ${count} ${noun} out of ` +
                `${KIND_LABEL[sourceKind]} changes how they’re counted and shifts ` +
                `your savings rate.`
              : null}
          </AlertDialog.Description>
          <div className="mt-5 flex justify-end gap-2">
            <AlertDialog.Close className="rounded-md px-3 py-2 text-sm font-medium text-foreground ring-1 ring-border hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              Cancel
            </AlertDialog.Close>
            <button
              type="button"
              onClick={onConfirm}
              className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Move anyway
            </button>
          </div>
        </AlertDialog.Popup>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}

/**
 * Bulk vendor rename (story 14). The input is prefilled with the most-common
 * vendor in the selection so the common "fix a typo across many rows" case is
 * one keystroke from done. Submitting writes the new vendor to every selected
 * row.
 *
 * When the selection spans more than one vendor — common on the global
 * `/transactions` list — the rename merges them all into one value, which is
 * easy to trigger by accident. A warning names the distinct vendors about to
 * be overwritten so the merge is deliberate, not a surprise.
 */
function RenameDialog({
  open,
  onOpenChange,
  count,
  noun,
  defaultVendor,
  selectedVendors,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  count: number;
  noun: string;
  defaultVendor: string | undefined;
  selectedVendors: string[];
  onSubmit: (vendor: string) => void;
}) {
  const [value, setValue] = useState("");
  const merging = selectedVendors.length > 1;

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
          {merging && (
            <div
              role="alert"
              className="mt-3 flex gap-2 rounded-lg bg-amber-50 p-3 text-xs text-amber-800 ring-1 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:ring-amber-900"
            >
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
              <p>
                Your selection spans {selectedVendors.length} vendors (
                <span className="font-medium">{selectedVendors.join(", ")}</span>). Renaming
                merges them all into the single name below.
              </p>
            </div>
          )}
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
