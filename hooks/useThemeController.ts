"use client";

import { useCallback, useEffect, useState } from "react";

import { THEME_STORAGE_KEY, parseThemePreference, resolveTheme } from "@/lib/theme";
import type { ResolvedTheme, ThemePreference } from "@/types/theme";

const SYSTEM_DARK_QUERY = "(prefers-color-scheme: dark)";

/**
 * Class-based theme controller. Reads the persisted preference, toggles the
 * `.dark` class on `<html>`, and re-resolves when the OS theme changes under a
 * "system" preference. `color-scheme` follows the class automatically via the
 * CSS in globals.css (chunk 1 of #79), so it stays in sync without extra work.
 *
 * The initial value is read synchronously from localStorage so the first
 * applied class matches what the before-paint script (ThemeScript) already set
 * — no second toggle, no flash. The before-paint script owns the very first
 * paint; this hook owns subsequent interaction and live system changes.
 */
export function useThemeController(): {
  preference: ThemePreference;
  resolvedTheme: ResolvedTheme;
  setPreference: (preference: ThemePreference) => void;
} {
  const [preference, setPreferenceState] = useState<ThemePreference>(() =>
    typeof window === "undefined"
      ? "system"
      : parseThemePreference(localStorage.getItem(THEME_STORAGE_KEY)),
  );
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>("light");

  useEffect(() => {
    const media = window.matchMedia(SYSTEM_DARK_QUERY);
    const apply = () => {
      const resolved = resolveTheme(preference, media.matches);
      document.documentElement.classList.toggle("dark", resolved === "dark");
      setResolvedTheme(resolved);
    };
    apply();
    // Listen unconditionally; resolveTheme ignores the system signal unless the
    // preference is "system", so changes are no-ops for explicit choices.
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [preference]);

  const setPreference = useCallback((next: ThemePreference) => {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Private-mode / storage-disabled: still apply for the session.
    }
    setPreferenceState(next);
  }, []);

  return { preference, resolvedTheme, setPreference };
}
