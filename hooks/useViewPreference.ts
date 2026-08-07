"use client";

import { useCallback, useState } from "react";

import { serializeViewCookie } from "@/lib/view";
import type { ViewPreference } from "@/types/view";

/**
 * The shared card/list view preference (#203), backing every `ViewToggle`.
 *
 * The initial value comes from the server, which read the persisted cookie
 * during render (see {@link parseViewPreference}) — so `initial` already matches
 * what was painted, and seeding state from it avoids both a hydration mismatch
 * and a flash-then-switch (story 3). Changing the view writes the cookie
 * directly (it holds no secret, so no server round-trip), which the next full
 * load reads back server-side (story 2).
 *
 * Controlled-surface pattern: one surface owns this hook and feeds `view` to
 * both its `ViewToggle` and its rendered content, so the toggle and the layout
 * never disagree. It is a read affordance — usable by everyone, viewers included
 * (story 6); nothing here mutates household data.
 */
export function useViewPreference(initial: ViewPreference): {
  view: ViewPreference;
  setView: (next: ViewPreference) => void;
} {
  const [view, setViewState] = useState<ViewPreference>(initial);

  const setView = useCallback((next: ViewPreference) => {
    try {
      document.cookie = serializeViewCookie(next);
    } catch {
      // Storage-disabled contexts still get the switch for this session.
    }
    setViewState(next);
  }, []);

  return { view, setView };
}
