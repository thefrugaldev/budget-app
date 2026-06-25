"use client";

import { Toast } from "@base-ui/react/toast";
import { Undo2 } from "lucide-react";

import type { UndoDeleteData } from "@/types/notify";

/**
 * Bespoke body for the optimistic-delete undo toast. Reads the per-toast
 * payload (vendor label, in-flight flag, undo handler) from `t.data`, set
 * by `useNotify().undoDelete(...)` and updated via `useNotify().update(id, ...)`
 * once the action goes in-flight. The Undo button is disabled when in-flight
 * — clicking after the action has started can't rescue the row.
 */
export function ToastUndoBody({
  toast,
}: {
  toast: { data?: UndoDeleteData; title: React.ReactNode };
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
