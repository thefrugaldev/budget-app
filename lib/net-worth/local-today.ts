/**
 * Today in the **browser's local** calendar as `YYYY-MM-DD`, composed by parts
 * to avoid locale/format surprises. Used where a net-worth record must land on
 * the user's today, not the server's UTC day (a close's final snapshot, a
 * check-in's snapshot set) — the server can't know the client's timezone, so the
 * client computes this and passes it in. Read it only after hydration
 * (`useHydrated`) so it never differs between the SSR and client renders.
 */
export function localTodayIso(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}
