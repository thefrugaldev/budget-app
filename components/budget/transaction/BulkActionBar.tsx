"use client";

import { FolderInput, Pencil, Trash2, X } from "lucide-react";
import { useState } from "react";

import { SignedAmount } from "@/components/budget/SignedAmount";
import { BarButton } from "@/components/budget/transaction/BarButton";
import { CrossKindConfirm } from "@/components/budget/transaction/CrossKindConfirm";
import { DeleteConfirm } from "@/components/budget/transaction/DeleteConfirm";
import { RecategoriseDialog } from "@/components/budget/transaction/RecategoriseDialog";
import { RenameDialog } from "@/components/budget/transaction/RenameDialog";
import type { Category, CategoryKind } from "@/types/budget";

type OpenDialog =
  | "none"
  | "delete"
  | "recategorise"
  | "recategorise-confirm"
  | "rename";

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
