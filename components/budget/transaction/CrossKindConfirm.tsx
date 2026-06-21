import { AlertDialog } from "@base-ui/react/alert-dialog";

import type { Category, CategoryKind } from "@/types/budget";

const BACKDROP =
  "fixed inset-0 z-40 bg-black/40 backdrop-blur-sm data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 transition-opacity";
const POPUP =
  "fixed left-1/2 top-1/2 z-50 w-[min(440px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-card p-6 shadow-xl ring-1 ring-border outline-none data-[ending-style]:opacity-0 data-[ending-style]:scale-95 data-[starting-style]:opacity-0 data-[starting-style]:scale-95 transition-[opacity,transform]";

const KIND_LABEL: Record<CategoryKind, string> = {
  expense: "expense",
  savings: "savings",
  income: "income",
};

/**
 * Guards a recategorise that crosses category kinds (e.g. moving expenses into
 * a savings or income category). That flips how the rows are counted and
 * re-weights the savings-rate maths on Pulse, so — unlike a same-kind move —
 * it earns a confirm that names the consequence. The common case never sees
 * this dialog; it only fires on a kind change.
 */
export function CrossKindConfirm({
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
