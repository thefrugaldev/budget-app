"use client";

import { Popover } from "@base-ui/react/popover";
import dynamic from "next/dynamic";
import { useState } from "react";

import { CategoryIcon } from "@/components/budget/category/CategoryIcon";
import { cn } from "@/lib/utils";

/**
 * Category icon picker (#80 chunk 4) — browse the entire lucide set (~1.7k
 * icons) and store the chosen icon's PascalCase name. Prop shape mirrors the
 * old emoji picker so it drops into the category / income forms; it writes the
 * name to a hidden `inputName` input (default `icon`).
 *
 * The trigger renders the current icon via the light `CategoryIcon` path; the
 * heavy searchable grid (`IconGrid`, which imports the full catalogue) is
 * lazy-loaded only when the popover opens, keeping it out of route bundles.
 */
const IconGrid = dynamic(() => import("./IconGrid"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[300px] items-center justify-center text-xs text-muted-foreground">
      Loading icons…
    </div>
  ),
});

export type CategoryIconPickerProps = {
  /** Controlled value — the lucide icon name. Pair with `onChange`. */
  value?: string;
  onChange?: (nextName: string) => void;
  /** Uncontrolled initial value. Ignored when `value` is provided. */
  defaultValue?: string;
  /** Name for the hidden form input that carries the icon name. Default `icon`. */
  inputName?: string;
  /**
   * Legacy emoji to render in the trigger when no icon name is chosen yet (e.g.
   * editing a category that predates the icon field).
   */
  fallbackEmoji?: string;
  /** Free-text name the user is typing; surfaces matching icons first. */
  nameHint?: string;
  /** Accessible label for the trigger button. */
  ariaLabel?: string;
  /** Extra classes for the trigger button. */
  className?: string;
};

export function CategoryIconPicker({
  value,
  onChange,
  defaultValue,
  inputName = "icon",
  fallbackEmoji,
  nameHint,
  ariaLabel = "Choose category icon",
  className,
}: CategoryIconPickerProps) {
  const [internal, setInternal] = useState(defaultValue ?? "");
  const isControlled = value !== undefined;
  const current = isControlled ? value : internal;

  function set(nextName: string) {
    if (!isControlled) setInternal(nextName);
    onChange?.(nextName);
  }

  const [open, setOpen] = useState(false);

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <input type="hidden" name={inputName} value={current} />
      <Popover.Trigger
        aria-label={ariaLabel}
        className={cn(
          "flex h-full w-full cursor-pointer items-center justify-center rounded-md bg-background py-2 text-foreground ring-1 ring-border outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring",
          className,
        )}
      >
        <CategoryIcon
          category={{ icon: current, emoji: fallbackEmoji }}
          className="size-5 bg-transparent text-current"
          iconClassName="size-5"
        />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner sideOffset={6} align="start" className="z-50">
          <Popover.Popup
            aria-label="Category icons"
            className="w-[300px] rounded-xl bg-card p-3 shadow-xl ring-1 ring-border outline-none transition-opacity data-[ending-style]:opacity-0 data-[starting-style]:opacity-0"
          >
            {open && (
              <IconGrid
                current={current}
                nameHint={nameHint}
                onSelect={(name) => {
                  set(name);
                  setOpen(false);
                }}
              />
            )}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
