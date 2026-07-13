"use client";

import { useId, useRef, useState } from "react";

import { useTickerSearch } from "@/hooks/useTickerSearch";
import { MIN_SEARCH_LENGTH } from "@/lib/net-worth/price/search-tickers";
import { cn } from "@/lib/utils";

/**
 * An accessible symbol-search combobox for entering a ticker (#144). Suggests
 * `SYMBOL — Name` matches as you type (debounced via {@link useTickerSearch})
 * while staying a plain text field underneath — you can always type a symbol the
 * search doesn't list. Follows the WAI-ARIA combobox-with-listbox pattern: the
 * input is `role="combobox"` with `aria-activedescendant` tracking the
 * highlighted option, the popup is a `role="listbox"` of `role="option"`s, and
 * ArrowUp/Down + Enter + Escape drive it from the keyboard (focus stays on the
 * input throughout). Choosing an option fills the field with its symbol and
 * fires `onSelect` (PR2 will price-check the chosen symbol there).
 *
 * Feature-local — only the add-holding form needs it today. If a second async
 * combobox appears, the search-agnostic mechanics here are what to lift into a
 * shared primitive.
 */
export function TickerCombobox({
  value,
  onChange,
  onSelect,
  name,
  required,
  ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  /** Fired when a suggestion is chosen (symbol only) — a hook for the PR2 price check. */
  onSelect?: (symbol: string) => void;
  name?: string;
  required?: boolean;
  ariaLabel?: string;
}) {
  const baseId = useId();
  const listId = `${baseId}-listbox`;
  const optionId = (i: number) => `${baseId}-option-${i}`;

  const { results, loading } = useTickerSearch(value);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const longEnough = value.trim().length >= MIN_SEARCH_LENGTH;
  const showPopup = open && longEnough && (loading || results.length > 0);
  const activeValid = active >= 0 && active < results.length;

  function choose(symbol: string) {
    onChange(symbol);
    onSelect?.(symbol);
    setOpen(false);
    setActive(-1);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) return setOpen(true);
      if (results.length > 0) setActive((a) => (a + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (results.length > 0) setActive((a) => (a <= 0 ? results.length - 1 : a - 1));
    } else if (e.key === "Enter") {
      if (open && activeValid) {
        e.preventDefault(); // choose the highlighted option instead of submitting
        choose(results[active].symbol);
      }
    } else if (e.key === "Escape") {
      if (open) {
        e.preventDefault();
        setOpen(false);
        setActive(-1);
      }
    }
  }

  return (
    <div className="relative">
      <input
        name={name}
        type="text"
        role="combobox"
        aria-label={ariaLabel}
        aria-expanded={showPopup}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={showPopup && activeValid ? optionId(active) : undefined}
        autoComplete="off"
        value={value}
        required={required}
        placeholder="VTI"
        onChange={(e) => {
          onChange(e.target.value.toUpperCase());
          setOpen(true);
          setActive(-1);
        }}
        onFocus={() => {
          if (blurTimer.current) clearTimeout(blurTimer.current);
          setOpen(true);
        }}
        onBlur={() => {
          // Delay the close so an option's click (which blurs the input) lands first.
          blurTimer.current = setTimeout(() => setOpen(false), 120);
        }}
        onKeyDown={onKeyDown}
        className="w-full rounded-md bg-background px-2 py-1.5 text-sm ring-1 ring-border outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
      {showPopup && (
        <ul
          id={listId}
          role="listbox"
          // Keep focus on the input so selecting doesn't blur-close before the click.
          onMouseDown={(e) => e.preventDefault()}
          className="absolute z-10 mt-1 max-h-56 w-full overflow-auto rounded-md bg-popover py-1 shadow-md ring-1 ring-border"
        >
          {results.length === 0 ? (
            <li className="px-2 py-1.5 text-xs text-muted-foreground">Searching…</li>
          ) : (
            results.map((r, i) => (
              <li
                key={r.symbol}
                id={optionId(i)}
                role="option"
                aria-selected={i === active}
                onMouseEnter={() => setActive(i)}
                onClick={() => choose(r.symbol)}
                className={cn(
                  "flex cursor-pointer items-baseline gap-2 px-2 py-1.5 text-sm",
                  i === active && "bg-muted",
                )}
              >
                <span className="font-medium">{r.symbol}</span>
                <span className="truncate text-xs text-muted-foreground">{r.description}</span>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
