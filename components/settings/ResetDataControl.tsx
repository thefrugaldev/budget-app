"use client";

import { useState } from "react";

import { resetAllDataAction } from "@/app/actions/reset";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { useNotify } from "@/hooks/useNotify";

/**
 * Danger-zone reset control (#81 story 9). Opens a typed-confirmation dialog
 * (reuses {@link ConfirmDialog} in its destructive tone) so a full wipe can't
 * happen by accident — the user must type "RESET". On confirm it clears all
 * local data via the server action; Cancel / Escape / backdrop are all no-ops.
 */
export function ResetDataControl() {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const notify = useNotify();

  async function handleConfirm() {
    setPending(true);
    try {
      const { error } = await resetAllDataAction();
      setOpen(false);
      if (error) {
        notify.error("Reset failed", error);
      } else {
        notify.success("All data cleared", "Your budget is now a blank slate.");
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="destructive"
        onClick={() => setOpen(true)}
        disabled={pending}
      >
        {pending ? "Clearing…" : "Clear all data"}
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        tone="destructive"
        requireType="RESET"
        title="Clear all data?"
        description="This permanently deletes every transaction, category, and target. It can't be undone."
        confirmLabel="Clear everything"
        onConfirm={handleConfirm}
      />
    </>
  );
}
