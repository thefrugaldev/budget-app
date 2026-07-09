"use client";

import { useEffect, useRef } from "react";

import { cn } from "@/lib/utils";

/**
 * Small controlled checkbox with tri-state support, used by the transaction
 * list's row / day-header / select-all selection boxes (issue #17 chunk 4).
 * A native `<input type="checkbox">` keeps it fully accessible for free; the
 * indeterminate (dash) state isn't expressible in JSX, so it's set on the DOM
 * node via a ref whenever `indeterminate` is true and the box isn't checked.
 *
 * `tabIndex={-1}` is passed for boxes inside the roving-tabindex list, where
 * the row itself is the single tab stop and Space toggles selection.
 */
export function Checkbox({
  checked,
  indeterminate = false,
  onCheckedChange,
  label,
  tabIndex,
  className,
}: {
  checked: boolean;
  indeterminate?: boolean;
  onCheckedChange: (checked: boolean) => void;
  /**
   * Accessible name, applied as `aria-label` — for boxes with no adjacent
   * visible label text (e.g. the transaction-list selection boxes). Omit it
   * when the checkbox is wrapped in a `<label>` whose visible text already names
   * it, so the box isn't doubly labelled.
   */
  label?: string;
  tabIndex?: number;
  className?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate && !checked;
  }, [indeterminate, checked]);

  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      onChange={(e) => onCheckedChange(e.target.checked)}
      aria-label={label}
      tabIndex={tabIndex}
      className={cn(
        "size-4 shrink-0 cursor-pointer accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
    />
  );
}
