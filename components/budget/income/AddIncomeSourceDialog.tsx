"use client";

import { Dialog } from "@base-ui/react/dialog";
import { useActionState, useEffect, useRef, useState } from "react";

import { createIncomeSourceAction } from "@/app/actions/income";
import { INCOME_ACTION_INITIAL } from "@/app/actions/income-state";
import { EmojiPickerButton } from "@/components/budget/shared/EmojiPickerButton";
import { AddIncomeSourceSubmitButton } from "@/components/budget/income/AddIncomeSourceSubmitButton";
import { useNotify } from "@/hooks/useNotify";

/**
 * Small create-source dialog reused by the floating ⊕ menu and by the on-page
 * "+ Add income source" button on `/income`. The compact form (emoji + name +
 * yearly) is intentionally the same shape regardless of where the user opens
 * it from (story 14 — no second-class create path on the page).
 */
export function AddIncomeSourceDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
}) {
  const [state, formAction] = useActionState(
    createIncomeSourceAction,
    INCOME_ACTION_INITIAL,
  );
  const notify = useNotify();
  const lastOk = useRef(state.ok);
  const [emoji, setEmoji] = useState("💰");
  const [name, setName] = useState("");
  // Reset emoji/name when the dialog transitions from open → closed, so the
  // next opening starts fresh. Render-time prev comparison (React 19's
  // set-state-in-effect rule forbids the more obvious useEffect form).
  const [prevOpen, setPrevOpen] = useState(open);
  if (prevOpen !== open) {
    setPrevOpen(open);
    if (!open) {
      setEmoji("💰");
      setName("");
    }
  }
  useEffect(() => {
    if (!open) lastOk.current = state.ok; // resync when dialog reopens
    else if (state.ok > lastOk.current && !state.error) {
      lastOk.current = state.ok;
      notify.success("Income source added");
      onOpenChange(false);
    }
  }, [open, state, onOpenChange, notify]);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 transition-opacity" />
        <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 w-[min(420px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-card p-6 shadow-xl ring-1 ring-border outline-none data-[ending-style]:opacity-0 data-[ending-style]:scale-95 data-[starting-style]:opacity-0 data-[starting-style]:scale-95 transition-[opacity,transform]">
          <Dialog.Title className="font-heading text-lg font-semibold">
            Add income source
          </Dialog.Title>
          <Dialog.Description className="mt-1 text-xs text-muted-foreground">
            New sources start today with their initial baseline.
          </Dialog.Description>
          <form action={formAction} className="mt-4 space-y-3">
            <div className="grid grid-cols-[64px_1fr] gap-2">
              <EmojiPickerButton
                value={emoji}
                onChange={setEmoji}
                nameHint={name}
                ariaLabel="Choose income source emoji"
              />
              <input
                name="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Side gig"
                required
                className="rounded-md bg-background px-2 py-1.5 text-sm ring-1 ring-border outline-none focus:ring-ring"
              />
            </div>
            <input
              name="yearly"
              type="number"
              step="0.01"
              min="0"
              inputMode="decimal"
              placeholder="$0/yr"
              required
              className="w-full rounded-md bg-background px-2 py-1.5 text-right text-sm tabular-nums ring-1 ring-border outline-none focus:ring-ring"
            />
            {state.error && (
              <p role="alert" className="text-xs text-destructive">
                {state.error}
              </p>
            )}
            <div className="flex items-center justify-end gap-2 pt-1">
              <Dialog.Close className="rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground">
                Cancel
              </Dialog.Close>
              <AddIncomeSourceSubmitButton />
            </div>
          </form>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
