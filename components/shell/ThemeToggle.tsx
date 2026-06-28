"use client";

import { Menu } from "@base-ui/react/menu";
import { Check, Monitor, Moon, Sun, type LucideIcon } from "lucide-react";

import { useThemeController } from "@/hooks/useThemeController";
import type { ThemePreference } from "@/types/theme";

const OPTIONS: { value: ThemePreference; label: string; Icon: LucideIcon }[] = [
  { value: "light", label: "Light", Icon: Sun },
  { value: "dark", label: "Dark", Icon: Moon },
  { value: "system", label: "System", Icon: Monitor },
];

/**
 * Header theme control — interim home for the light/dark/system toggle (chunk 2
 * of #79). #81 relocates this into the Settings page once that route is real.
 *
 * No hydration gate is needed: `resolvedTheme` starts "light" on both server and
 * client (the apply effect runs only after hydration), and the active-preference
 * checkmark lives in the popup, which Base UI doesn't render until the menu
 * opens — so the first client render matches the server markup.
 */
export function ThemeToggle() {
  const { preference, resolvedTheme, setPreference } = useThemeController();
  const TriggerIcon = resolvedTheme === "dark" ? Moon : Sun;

  return (
    <Menu.Root>
      <Menu.Trigger
        aria-label="Theme"
        className="inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring aria-expanded:bg-muted aria-expanded:text-foreground"
      >
        <TriggerIcon className="size-5" aria-hidden />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner sideOffset={8} align="end" className="z-30 outline-none">
          <Menu.Popup className="min-w-40 rounded-xl bg-card p-1 text-sm shadow-xl ring-1 ring-border outline-none">
            {OPTIONS.map(({ value, label, Icon }) => (
              <Menu.Item
                key={value}
                onClick={() => setPreference(value)}
                className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 outline-none data-[highlighted]:bg-muted"
              >
                <Icon className="size-4 text-muted-foreground" aria-hidden />
                <span className="flex-1">{label}</span>
                {preference === value && <Check className="size-4" aria-hidden />}
              </Menu.Item>
            ))}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
