/**
 * Shared chrome for app modals built on Base UI `Dialog` / `AlertDialog`.
 * `MODAL_POPUP` is the compact ~440px confirm/picker width; wider surfaces
 * (edit forms) set their own width inline. Kept as plain class strings so both
 * the `Dialog.*` and `AlertDialog.*` element families can share them.
 */
export const MODAL_BACKDROP =
  "fixed inset-0 z-40 bg-black/40 backdrop-blur-sm data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 transition-opacity";

export const MODAL_POPUP =
  "fixed left-1/2 top-1/2 z-50 w-[min(440px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-card p-6 shadow-xl ring-1 ring-border outline-none data-[ending-style]:opacity-0 data-[ending-style]:scale-95 data-[starting-style]:opacity-0 data-[starting-style]:scale-95 transition-[opacity,transform]";
