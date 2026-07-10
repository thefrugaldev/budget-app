"use client";

import { Pencil } from "lucide-react";
import { useState } from "react";

import { AccountEditSheet } from "@/components/net-worth/AccountEditSheet";
import { useCanEdit } from "@/hooks/useCanEdit";
import type { Account } from "@/types/net-worth";

/**
 * The per-card edit affordance (#109 chunk 7): a pencil that opens the account's
 * edit sheet. Hidden for viewers — a pure edit affordance, so it returns null
 * rather than a control that would 403 (`useCanEdit`; the server action is the
 * real boundary). The page mounts it in the card's `action` slot.
 */
export function AccountCardActions({
  account,
  hasHistory,
}: {
  account: Account;
  hasHistory: boolean;
}) {
  const canEdit = useCanEdit();
  const [open, setOpen] = useState(false);
  if (!canEdit) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Edit ${account.name}`}
        className="shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Pencil className="size-4" aria-hidden />
      </button>
      <AccountEditSheet
        account={account}
        hasHistory={hasHistory}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}
