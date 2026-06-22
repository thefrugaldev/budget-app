import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { fmtExact } from "@/lib/budget";

/**
 * Destructive confirm that names the count *and* total (story 11) so a misclick
 * can't silently wipe a batch. Built on the shared {@link ConfirmDialog}
 * (role=alertdialog, focus on Cancel); the action is still reversible for ~5s
 * after via the undo toast that `onConfirm` kicks off.
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
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      tone="destructive"
      title={`Delete ${count} ${noun}?`}
      description={
        <>
          This removes {count} {noun} totalling{" "}
          <span className="font-medium text-foreground tabular-nums">
            {fmtExact(total)}
          </span>
          . You&rsquo;ll have a few seconds to undo.
        </>
      }
      confirmLabel={`Delete ${count} ${noun}`}
      onConfirm={onConfirm}
    />
  );
}
