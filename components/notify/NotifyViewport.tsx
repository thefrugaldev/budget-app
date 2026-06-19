"use client";

import { Toast } from "@base-ui/react/toast";
import { AlertCircle, CheckCircle2, Undo2, X } from "lucide-react";

import { cn } from "@/lib/utils";

import type { NotifyData, NotifyType, UndoDeleteData } from "@/types/notify";

/**
 * Bottom-left viewport for all toasts. Mounted by `<NotifyRoot>` once at the
 * app root; individual call sites just emit via `useNotify`. Toast variants
 * are picked off the `type` field — anything unrecognised falls back to the
 * neutral success-style chrome so a misregistered toast still renders.
 */
export function NotifyViewport() {
  const { toasts } = Toast.useToastManager<NotifyData>();
  return (
    <Toast.Portal>
      <Toast.Viewport className="fixed bottom-8 left-8 z-50 flex w-[320px] flex-col-reverse gap-2 outline-none">
        {toasts.map((t) => {
          const type = (t.type ?? "success") as NotifyType;
          return (
            <Toast.Root
              key={t.id}
              toast={t}
              className={cn(
                "group relative flex items-start gap-3 rounded-lg bg-card px-4 py-3 text-sm shadow-xl ring-1 transition-[opacity,transform]",
                "data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 data-[starting-style]:translate-y-2",
                // Base UI's `limit` doesn't remove evicted toasts; it just
                // marks them `data-limited` and expects us to style them out.
                // Without this rule, overflow toasts pile up vertically and
                // the viewport scrolls past the visible cap.
                "data-[limited]:pointer-events-none data-[limited]:opacity-0",
                type === "error"
                  ? "ring-rose-200 dark:ring-rose-900"
                  : "ring-border",
              )}
            >
              {type === "undo-delete" ? (
                <UndoBody toast={t as { data?: UndoDeleteData; title: React.ReactNode }} />
              ) : (
                <DefaultBody type={type} title={t.title} description={t.description} />
              )}
            </Toast.Root>
          );
        })}
      </Toast.Viewport>
    </Toast.Portal>
  );
}

function DefaultBody({
  type,
  title,
  description,
}: {
  type: NotifyType;
  title: React.ReactNode;
  description: React.ReactNode;
}) {
  return (
    <>
      <span aria-hidden className="mt-0.5 shrink-0">
        {type === "error" ? (
          <AlertCircle className="size-4 text-rose-600 dark:text-rose-400" />
        ) : (
          <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <Toast.Title className="font-medium leading-tight">{title}</Toast.Title>
        {description && (
          <Toast.Description className="mt-0.5 text-xs text-muted-foreground">
            {description}
          </Toast.Description>
        )}
      </div>
      <Toast.Close
        aria-label="Dismiss"
        className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <X className="size-3.5" aria-hidden />
      </Toast.Close>
    </>
  );
}

/**
 * Bespoke body for the optimistic-delete undo toast. Reads the per-toast
 * payload (vendor label, in-flight flag, undo handler) from `t.data`, set
 * by `useNotify().undoDelete(...)` and updated via `useNotify().update(id, ...)`
 * once the action goes in-flight. The Undo button is disabled when in-flight
 * — clicking after the action has started can't rescue the row.
 */
function UndoBody({
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
