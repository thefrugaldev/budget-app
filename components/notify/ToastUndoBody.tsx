"use client";

import { Toast } from "@base-ui/react/toast";
import { Undo2 } from "lucide-react";

import type { UndoActionData } from "@/types/notify";

/**
 * Bespoke body for the action-carrying undo toasts (`undo-delete` and the
 * generic `undo-action`). Reads the common payload (in-flight flag + undo
 * handler) from `t.data` — set by `useNotify().undoDelete/undoAction(...)` and
 * updated via `useNotify().update(id, ...)` once the action goes in-flight — and
 * uses the toast's own `title` as the label. The Undo button is disabled when
 * in-flight, since clicking after the action has started can't rescue the row.
 */
export function ToastUndoBody({
  toast,
}: {
  toast: { data?: UndoActionData; title: React.ReactNode };
}) {
  const data = toast.data;
  return (
    <>
      <Toast.Title className="flex-1 leading-tight">{toast.title}</Toast.Title>
      <Toast.Action
        onClick={() => data?.onUndo()}
        disabled={data?.inFlight}
        className="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-primary hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent"
      >
        <Undo2 className="size-3.5" aria-hidden />
        Undo
      </Toast.Action>
    </>
  );
}
