"use client";

import { LayoutGrid, LayoutList, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import type { ViewPreference } from "@/types/view";

const OPTIONS: { value: ViewPreference; label: string; Icon: LucideIcon }[] = [
  { value: "card", label: "Cards", Icon: LayoutGrid },
  { value: "list", label: "List", Icon: LayoutList },
];

/**
 * The shared Cards/List switch for every card-grid surface (#203). A single
 * control so the toggle looks and behaves identically wherever card grids appear
 * (story 4), rather than each surface inventing its own.
 *
 * Controlled: the surface owns the {@link useViewPreference} state and feeds
 * `view`/`onChange`, so the toggle and the rendered layout stay in lockstep. A
 * read affordance — rendered for everyone, viewers included (story 6); it
 * changes presentation, not data.
 *
 * Mirrors the house segmented-radio pattern (`CadenceField`/`ThemeControl`):
 * `role="radiogroup"` of `aria-checked` buttons, icon + text label (never colour
 * alone), Harvest tokens, visible focus ring.
 */
export function ViewToggle({
  view,
  onChange,
  label = "View",
}: {
  view: ViewPreference;
  onChange: (next: ViewPreference) => void;
  /** Accessible name for the group — name the surface it controls, e.g. "Accounts view". */
  label?: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-grid grid-cols-2 gap-1.5">
      {OPTIONS.map(({ value, label: optionLabel, Icon }) => {
        const selected = view === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(value)}
            className={cn(
              "flex items-center justify-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium ring-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              selected
                ? "bg-primary text-primary-foreground ring-primary"
                : "bg-background text-muted-foreground ring-border hover:bg-muted hover:text-foreground",
            )}
          >
            <Icon className="size-4" aria-hidden />
            {optionLabel}
          </button>
        );
      })}
    </div>
  );
}
