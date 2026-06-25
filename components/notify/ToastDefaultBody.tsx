"use client";

import { Toast } from "@base-ui/react/toast";
import { AlertCircle, CheckCircle2, X } from "lucide-react";

import type { NotifyType } from "@/types/notify";

/**
 * Standard toast body — an icon (error vs success), title/description, and a
 * close button. Used for every variant except the bespoke undo-delete toast,
 * which renders {@link ToastUndoBody}.
 */
export function ToastDefaultBody({
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
