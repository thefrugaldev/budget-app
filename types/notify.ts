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
export type NotifyType = "success" | "error" | "undo-delete" | "undo-action";

/**
 * The minimal payload any action-carrying toast needs: an undo handler and an
 * `inFlight` flag that disables the button once the underlying mutation has
 * started. `undo-delete` extends it with a vendor label for its title copy;
 * `undo-action` (e.g. accepting a Target suggestion) carries nothing extra —
 * its title is passed straight through.
 */
export type UndoActionData = {
  inFlight: boolean;
  onUndo: () => void;
};

/** Payload shape for the bespoke undo-delete toast. */
export type UndoDeleteData = UndoActionData & {
  vendorLabel: string;
};

export type NotifyData = UndoDeleteData | UndoActionData;
