"use client";

import { ClipboardCheck } from "lucide-react";
import { useState } from "react";

import { CheckInSheet } from "@/components/net-worth/CheckInSheet";
import { useCanEdit } from "@/hooks/useCanEdit";
import type { Account } from "@/types/net-worth";

/**
 * Opens the single-page check-in (#109 chunk 8) — the primary monthly action, so
 * it's the prominent button. Hidden for viewers (a pure edit affordance; the
 * server action is the real gate). The page renders it only when there's at
 * least one open account to check in.
 */
export function CheckInButton({
  accounts,
  prices,
}: {
  accounts: Account[];
  prices: Record<string, number>;
}) {
  const canEdit = useCanEdit();
  const [open, setOpen] = useState(false);
  if (!canEdit) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ClipboardCheck className="size-4" aria-hidden />
        Check in
      </button>
      <CheckInSheet open={open} onOpenChange={setOpen} accounts={accounts} prices={prices} />
    </>
  );
}
