"use client";

import { Autocomplete } from "@base-ui/react/autocomplete";

/**
 * Vendor field for {@link TransactionForm}. With no suggestions it renders a
 * plain text input; given prior-vendor options it upgrades to an autocomplete
 * (Base UI) that still allows free text for a brand-new vendor.
 */
export function VendorInput({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder: string;
}) {
  // No options → plain input. Autocomplete with an empty list works but it
  // noisily renders an empty popup on focus.
  if (options.length === 0) {
    return (
      <input
        name="vendor"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-md bg-background px-2 py-1.5 text-sm ring-1 ring-border outline-none focus:ring-ring"
      />
    );
  }
  return (
    <Autocomplete.Root
      items={options}
      value={value}
      onValueChange={(next) => onChange(next)}
      openOnInputClick
    >
      <Autocomplete.Input
        name="vendor"
        placeholder={placeholder}
        className="w-full rounded-md bg-background px-2 py-1.5 text-sm ring-1 ring-border outline-none focus:ring-ring"
      />
      <Autocomplete.Portal>
        <Autocomplete.Positioner sideOffset={4} className="z-[60] outline-none">
          <Autocomplete.Popup className="max-h-56 overflow-auto rounded-md bg-card p-1 text-sm shadow-md ring-1 ring-border outline-none">
            <Autocomplete.Empty className="px-2 py-1.5 text-xs text-muted-foreground">
              No matches — type a new vendor.
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
