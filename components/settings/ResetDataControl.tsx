"use client";

import { useState } from "react";

import { resetAllDataAction } from "@/app/actions/reset";
import { Checkbox } from "@/components/ui/Checkbox";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { useNotify } from "@/hooks/useNotify";

/**
 * Danger-zone reset control (#81 story 9). Opens a typed-confirmation dialog
 * (reuses {@link ConfirmDialog} in its destructive tone) so a full wipe can't
 * happen by accident — the user must type "RESET". On confirm it clears the
 * household's local data via the server action; Cancel / Escape / backdrop are
 * all no-ops.
 *
 * By default the reset spares data imported from the spreadsheet archive
 * (#118 story 14); an explicit opt-in checkbox includes it, and the dialog copy
 * changes to make the wider blast radius obvious.
 */
export function ResetDataControl() {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [includeImported, setIncludeImported] = useState(false);
  const notify = useNotify();

  async function handleConfirm() {
    setPending(true);
    try {
      const { error } = await resetAllDataAction({ includeImported });
      setOpen(false);
      if (error) {
        notify.error("Reset failed", error);
      } else {
        notify.success("All data cleared", "Your budget is now a blank slate.");
        setIncludeImported(false);
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-3">
      {/* The wrapping <label> names the checkbox via its visible text, so no
          aria-label prop (which would doubly-label it). */}
      <label className="flex items-center gap-2 text-sm text-muted-foreground">
        <Checkbox checked={includeImported} onCheckedChange={setIncludeImported} />
        Also delete imported spreadsheet history
      </label>
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
        description={
          includeImported
            ? "This permanently deletes everything — every hand-entered transaction, category, and target AND the history imported from your spreadsheet archive. It can't be undone."
            : "This permanently deletes every transaction, category, and target you entered by hand. History imported from your spreadsheet archive is kept. It can't be undone."
        }
        confirmLabel="Clear everything"
        onConfirm={handleConfirm}
      />
    </div>
  );
}
