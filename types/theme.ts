/** User-facing theme choice. "system" follows the OS `prefers-color-scheme`. */
export type ThemePreference = "light" | "dark" | "system";

/** The concrete theme actually applied to the document (`.dark` on or off). */
export type ResolvedTheme = "light" | "dark";
