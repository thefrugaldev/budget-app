"use client";

import { Autocomplete } from "@base-ui/react/autocomplete";

/**
 * A free-text input that autocompletes over prior values (Base UI): pick an
 * existing suggestion or type a brand-new one — the autocomplete never blocks a
 * new value. With no suggestions it degrades to a plain text input, since an
 * empty autocomplete pops a noisy empty list on focus.
 *
 * Shared by the transaction vendor field and the net-worth institution field:
 * one unit parametrised by `name` (and `ariaLabel` / `emptyMessage`) rather than
 * two near-identical clones. The visible label lives on the caller's wrapping
 * `<label>`; pass `ariaLabel` to also give the control an explicit accessible
 * name regardless of the wrapper.
 */
export function SuggestInput({
  name,
  value,
  onChange,
  options,
  placeholder,
  required = false,
  ariaLabel,
  emptyMessage = "No matches — type a new value.",
}: {
  name: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder?: string;
  required?: boolean;
  ariaLabel?: string;
  emptyMessage?: string;
}) {
  // No options → plain input. Autocomplete with an empty list works but it
  // noisily renders an empty popup on focus.
  if (options.length === 0) {
    return (
      <input
        name={name}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        aria-label={ariaLabel}
        className="w-full rounded-md bg-background px-2 py-1.5 text-sm ring-1 ring-border outline-none focus:ring-ring"
      />
    );
  }
  return (
    <Autocomplete.Root
      items={options}
      // Cap how many suggestions render, not which values are searchable: Base UI
      // filters the full `items` list by the query first, then shows up to `limit`
      // matches. So an empty query shows the top 50, but typing any value's name
      // still surfaces it — and the popup never mounts more than 50 nodes.
      limit={50}
      value={value}
      onValueChange={(next) => onChange(next)}
      openOnInputClick
    >
      <Autocomplete.Input
        name={name}
        placeholder={placeholder}
        required={required}
        aria-label={ariaLabel}
        className="w-full rounded-md bg-background px-2 py-1.5 text-sm ring-1 ring-border outline-none focus:ring-ring"
      />
      <Autocomplete.Portal>
        <Autocomplete.Positioner sideOffset={4} className="z-[60] outline-none">
          <Autocomplete.Popup className="max-h-56 overflow-auto rounded-md bg-card p-1 text-sm shadow-md ring-1 ring-border outline-none">
            {/* Base UI keeps this live region mounted at all times so a screen
                reader announces the empty state; collapse its vertical padding
                while it's empty so it doesn't leave a blank sliver above the
                suggestions. */}
            <Autocomplete.Empty className="px-2 py-0 text-xs text-muted-foreground [&:not(:empty)]:py-1.5">
              {emptyMessage}
            </Autocomplete.Empty>
            <Autocomplete.List>
              {(item: string) => (
                <Autocomplete.Item
                  key={item}
                  value={item}
                  className="cursor-pointer rounded-sm px-2 py-1.5 text-sm data-[highlighted]:bg-muted"
                >
                  {item}
                </Autocomplete.Item>
              )}
            </Autocomplete.List>
          </Autocomplete.Popup>
        </Autocomplete.Positioner>
      </Autocomplete.Portal>
    </Autocomplete.Root>
  );
}
