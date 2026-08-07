import type { ViewPreference } from "@/types/view";

/**
 * Cookie holding the persisted {@link ViewPreference}. A cookie (not
 * localStorage) so the server component can read it during render and pick the
 * initial view — the first paint is already correct, with no flash-then-switch
 * (issue #203, story 3). It carries no secret, so it's a plain readable cookie
 * the client writes directly; there's no server action in the write path.
 */
export const VIEW_COOKIE = "budget-view";

/** The default when no preference is stored — cards stay the default (#203). */
export const DEFAULT_VIEW: ViewPreference = "card";

/** A year, in seconds — the persisted preference outlives the session. */
const VIEW_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/**
 * Coerce an arbitrary stored value into a valid preference, defaulting to
 * {@link DEFAULT_VIEW} for anything unrecognised (missing cookie, legacy value,
 * tampering). The server reads the cookie through this to choose the initial
 * view, and the client hook seeds its state from the same source, so the two
 * always agree and there's no hydration mismatch.
 */
export function parseViewPreference(
  raw: string | null | undefined,
): ViewPreference {
  return raw === "card" || raw === "list" ? raw : DEFAULT_VIEW;
}

/**
 * The `document.cookie` assignment string that persists a choice. Pure (no DOM)
 * so it's unit-testable; the hook assigns the result. `SameSite=Lax` and a
 * root path keep it readable by every server render of the app.
 */
export function serializeViewCookie(view: ViewPreference): string {
  return `${VIEW_COOKIE}=${view}; path=/; max-age=${VIEW_COOKIE_MAX_AGE}; samesite=lax`;
}
