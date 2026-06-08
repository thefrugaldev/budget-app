"use client";

import { Toast } from "@base-ui/react/toast";

import { NotifyViewport } from "./NotifyViewport";

/**
 * Mounts Base UI's `<Toast.Provider>` around the whole app so any client
 * component can call `useNotify()` to surface a success / error / custom
 * toast. The viewport is rendered alongside so the toasts have a place to
 * land (bottom-left, per the chunk-8 undo toast position).
 *
 * Decision: thin wrapper over Base UI Toast rather than an in-house queue —
 * Base UI ships exactly the API we need (priority, timeout, limit, swipe-to-
 * dismiss, pause-on-hover, accessibility) and matches the design language of
 * the existing Menu / Dialog / Autocomplete components.
 *
 * `limit={3}` evicts the oldest toast when a 4th arrives.
 * `timeout={5000}` is just the provider default — individual emissions
 * override (success: 4s, error: 8s, undo: sticky).
 */
export function NotifyRoot({ children }: { children: React.ReactNode }) {
  return (
    <Toast.Provider limit={3} timeout={5000}>
      {children}
      <NotifyViewport />
    </Toast.Provider>
  );
}
