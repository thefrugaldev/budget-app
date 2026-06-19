/**
 * Toast variant types for the notify system. Shared between the hook that
 * emits toasts (`@/hooks/useNotify`) and the viewport that renders them
 * (`@/components/notify`), so they live in `types/` per the code-organization
 * conventions rather than co-located with either consumer.
 */

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
