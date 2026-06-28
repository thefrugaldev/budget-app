import type { ResolvedTheme, ThemePreference } from "@/types/theme";

/** localStorage key holding the persisted {@link ThemePreference}. */
export const THEME_STORAGE_KEY = "budget-theme";

/**
 * Coerce an arbitrary stored value into a valid preference, defaulting to
 * "system" for anything unrecognised (missing key, legacy value, tampering).
 */
export function parseThemePreference(
  raw: string | null | undefined,
): ThemePreference {
  return raw === "light" || raw === "dark" || raw === "system" ? raw : "system";
}

/**
 * Resolve a preference to the concrete theme. The system signal is consulted
 * only for "system"; an explicit "light"/"dark" choice always wins over it.
 */
export function resolveTheme(
  preference: ThemePreference,
  systemPrefersDark: boolean,
): ResolvedTheme {
  if (preference === "system") return systemPrefersDark ? "dark" : "light";
  return preference;
}
