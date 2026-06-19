"use client";

import { Toast } from "@base-ui/react/toast";
import { useMemo } from "react";

import type { NotifyData, NotifyType } from "@/types/notify";

/**
 * Shared toast emitter. Lives on top of Base UI's `useToastManager` and
 * pre-bakes the variant defaults: `success` is announced politely with a
 * 4s lifetime, `error` is announced assertively with an 8s lifetime, and
 * `custom` is sticky until explicitly closed (used by the undo-delete toast).
 *
 * The hook only collapses what would otherwise be repeated keyword args at
 * every call site — the underlying manager API is still available via the
 * `update` / `dismiss` returns for cases that need it.
 */
export function useNotify() {
  const manager = Toast.useToastManager<NotifyData>();
  return useMemo(
    () => ({
      success: (title: string, description?: string) =>
        manager.add({
          type: "success" satisfies NotifyType,
          priority: "low",
          timeout: 4000,
          title,
          description,
        }),
      error: (title: string, description?: string) =>
        manager.add({
          type: "error" satisfies NotifyType,
          priority: "high",
          timeout: 8000,
          title,
          description,
        }),
      undoDelete: (args: {
        id: string;
        vendorLabel: string;
        onUndo: () => void;
      }) =>
        manager.add({
          id: args.id,
          type: "undo-delete" satisfies NotifyType,
          priority: "low",
          timeout: 0, // sticky — the TransactionList timer drives lifecycle
          title: `Deleted ${args.vendorLabel}`,
          data: { vendorLabel: args.vendorLabel, inFlight: false, onUndo: args.onUndo },
        }),
      // Bulk-delete variant (issue #17 chunk 4): same sticky undo toast as the
      // single-row one, but the title names the count instead of a vendor. The
      // bulk-delete timer in TransactionList drives its lifecycle identically.
      undoBulkDelete: (args: { id: string; count: number; onUndo: () => void }) => {
        const label = `${args.count} ${args.count === 1 ? "transaction" : "transactions"}`;
        return manager.add({
          id: args.id,
          type: "undo-delete" satisfies NotifyType,
          priority: "low",
          timeout: 0,
          title: `Deleted ${label}`,
          data: { vendorLabel: label, inFlight: false, onUndo: args.onUndo },
        });
      },
      update: manager.update,
      dismiss: manager.close,
    }),
    [manager],
  );
}
