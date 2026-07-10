"use client";

import { useState } from "react";

import { closeAccountAction, deleteAccountAction } from "@/app/actions/net-worth";
import { AccountActionDialog } from "@/components/net-worth/AccountActionDialog";
import { useCanEdit } from "@/hooks/useCanEdit";
import { useHydrated } from "@/hooks/useHydrated";
import type { Account } from "@/types/net-worth";

/** Today in the *browser's* local calendar (YYYY-MM-DD) — composed by parts to
 *  avoid locale/format surprises. Used so a close records under the user's today,
 *  not the server's UTC day. */
function localTodayIso(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

/**
 * The Status section of an account's edit sheet (#109 chunk 7, story 16). Close
 * is always available (records a final $0 snapshot, drops the account from the
 * headline/check-in, keeps its history in the chart). Delete only shows when the
 * account has **no** recorded history — an account with snapshots is closed, not
 * deleted, so the trajectory keeps its past (the server enforces this; the UI
 * mirrors it). Both go through a confirm step. `onDone` lets the sheet close
 * itself once the account has left the live view.
 *
 * Assumed rendered only for open accounts (the cards that host the edit sheet
 * are open-only), so there's no reopen path here.
 */
export function AccountLifecycleActions({
  account,
  hasHistory,
  onDone,
}: {
  account: Account;
  hasHistory: boolean;
  onDone?: () => void;
}) {
  const canEdit = useCanEdit();
  const [closeOpen, setCloseOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  // Only read the browser's local day once hydrated, so the hidden `date` never
  // differs between the server (UTC) render and the client — avoids both a
  // hydration mismatch and the forbidden setState-in-effect. Empty pre-hydration
  // is fine: the dialog is only submittable after the user opens it.
  const today = useHydrated() ? localTodayIso() : "";

  // The edit sheet is unreachable for viewers (the pencil is hidden), but guard
  // the destructive lifecycle actions here too so they never render (story 9).
  if (!canEdit) return null;

  return (
    <section className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Status</p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setCloseOpen(true)}
          className="rounded-md px-2 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Close account
        </button>
        {!hasHistory && (
          <button
            type="button"
            onClick={() => setDeleteOpen(true)}
            className="rounded-md px-2 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Delete account
          </button>
        )}
      </div>
      <p className="text-[11px] text-muted-foreground">
        {hasHistory
          ? "Closing records a final $0 snapshot and removes it from the headline; its recorded history stays in the chart."
          : "No history yet — Delete removes it entirely, or Close retires it while keeping a record."}
      </p>

      <AccountActionDialog
        open={closeOpen}
        onOpenChange={setCloseOpen}
        accountId={account.id}
        title={`Close ${account.name}?`}
        description="Records a final $0 snapshot and removes it from the headline and check-in. Its history stays in the trajectory chart."
        confirmLabel="Close account"
        pendingLabel="Closing…"
        successMessage={`${account.name} closed`}
        action={closeAccountAction}
        dateValue={today}
        onSuccess={onDone}
      />
      <AccountActionDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        accountId={account.id}
        title={`Delete ${account.name}?`}
        description="Permanently removes this account. It has no recorded history, so nothing is lost from the chart."
        confirmLabel="Delete account"
        pendingLabel="Deleting…"
        successMessage={`${account.name} deleted`}
        action={deleteAccountAction}
        onSuccess={onDone}
      />
    </section>
  );
}
