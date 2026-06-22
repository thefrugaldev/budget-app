import { AlertDialog } from "@base-ui/react/alert-dialog";

import { MODAL_BACKDROP, MODAL_POPUP } from "@/components/ui/dialogClasses";

/**
 * Reusable confirm modal (Base UI `AlertDialog`): a title + description over a
 * Cancel / confirm footer. Focus lands on Cancel by default (role=alertdialog),
 * so an accidental Enter doesn't fire the action. `tone` switches the confirm
 * button between the primary and destructive palettes; callers compose the
 * `title` / `description` content (including any rich markup or computed copy).
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  onConfirm,
  tone = "primary",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  description: React.ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  tone?: "primary" | "destructive";
}) {
  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Portal>
        <AlertDialog.Backdrop className={MODAL_BACKDROP} />
        <AlertDialog.Popup className={MODAL_POPUP}>
          <AlertDialog.Title className="font-heading text-lg font-semibold">
            {title}
          </AlertDialog.Title>
          <AlertDialog.Description className="mt-1 text-sm text-muted-foreground">
            {description}
          </AlertDialog.Description>
          <div className="mt-5 flex justify-end gap-2">
            <AlertDialog.Close className="rounded-md px-3 py-2 text-sm font-medium text-foreground ring-1 ring-border hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              Cancel
            </AlertDialog.Close>
            <button
              type="button"
              onClick={onConfirm}
              className={
                tone === "destructive"
                  ? "rounded-md bg-rose-600 px-3 py-2 text-sm font-medium text-white hover:bg-rose-600/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  : "rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              }
            >
              {confirmLabel}
            </button>
          </div>
        </AlertDialog.Popup>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
