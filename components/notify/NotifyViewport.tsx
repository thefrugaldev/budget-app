"use client";

import { Toast } from "@base-ui/react/toast";

import { ToastDefaultBody } from "@/components/notify/ToastDefaultBody";
import { ToastUndoBody } from "@/components/notify/ToastUndoBody";
import { cn } from "@/lib/utils";

import type { NotifyData, NotifyType, UndoActionData } from "@/types/notify";

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
                  ? "ring-signal-bad/40"
                  : "ring-border",
              )}
            >
              {type === "undo-delete" || type === "undo-action" ? (
                <ToastUndoBody toast={t as { data?: UndoActionData; title: React.ReactNode }} />
              ) : (
                <ToastDefaultBody type={type} title={t.title} description={t.description} />
              )}
            </Toast.Root>
          );
        })}
      </Toast.Viewport>
    </Toast.Portal>
  );
}
