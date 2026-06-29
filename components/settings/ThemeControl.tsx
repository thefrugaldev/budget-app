"use client";

import { Monitor, Moon, Sun, type LucideIcon } from "lucide-react";

import { useHydrated } from "@/hooks/useHydrated";
import { useThemeController } from "@/hooks/useThemeController";
import { cn } from "@/lib/utils";
import type { ThemePreference } from "@/types/theme";

const OPTIONS: { value: ThemePreference; label: string; Icon: LucideIcon }[] = [
  { value: "light", label: "Light", Icon: Sun },
  { value: "dark", label: "Dark", Icon: Moon },
  { value: "system", label: "System", Icon: Monitor },
];

/**
 * Inline light/dark/system control for the Settings → Appearance section. The
 * permanent home of the theme preference; #79 parked it in the header as an
 * interim popover, and #81 chunk 2 moves it here (the header control is gone).
 *
 * Reuses {@link useThemeController} — no second theme implementation — and
 * mirrors the house segmented-radio pattern (`CadenceField`).
 *
 * `preference` reads from `localStorage` on the client but defaults to
 * `"system"` on the server, so the *shown* selection is gated on mount: the
 * first client render matches the server markup (no hydration mismatch), then
 * the real preference settles. The active theme itself is already correct
 * before paint via `ThemeScript`; only this highlight catches up.
 */
export function ThemeControl() {
  const { preference, setPreference } = useThemeController();
  const hydrated = useHydrated();
  const shown: ThemePreference = hydrated ? preference : "system";

  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      className="grid grid-cols-3 gap-1.5 sm:max-w-sm"
    >
      {OPTIONS.map(({ value, label, Icon }) => {
        const selected = shown === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => setPreference(value)}
            className={cn(
              "flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium ring-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              selected
                ? "bg-primary text-primary-foreground ring-primary"
                : "bg-background text-muted-foreground ring-border hover:bg-muted hover:text-foreground",
            )}
          >
            <Icon className="size-4" aria-hidden />
            {label}
          </button>
        );
      })}
    </div>
  );
}
