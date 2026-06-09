"use client";

import { Toast } from "@base-ui/react/toast";
import { useMemo } from "react";

/**
 * Variant tags carried on each toast's `type` field — the viewport switches
 * its render path on these. Kept narrow on purpose; new variants should be
 * added here so the renderer covers them exhaustively.
 */
export type NotifyType = "success" | "error" | "undo-delete";

/** Payload shape for the bespoke undo-delete toast. */
export type UndoDeleteData = {
  vendorLabel: string;
  inFlight: boolean;
  onUndo: () => void;
};

export type NotifyData = UndoDeleteData;

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
      update: manager.update,
      dismiss: manager.close,
    }),
    [manager],
  );
}
