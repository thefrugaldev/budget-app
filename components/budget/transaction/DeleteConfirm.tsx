import { AlertDialog } from "@base-ui/react/alert-dialog";

import { fmtExact } from "@/lib/budget";

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
export function DeleteConfirm({
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
