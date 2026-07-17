"use client";

import { X } from "lucide-react";
import { useEffect, useId, useLayoutEffect, useRef } from "react";

import {
  formatAmount,
  formatAmountParts,
  padOnBlur,
  sanitizeAmount,
} from "@/lib/budget";
import { cn } from "@/lib/utils";
import type { AmountPrecision } from "@/types/budget";

// Caret fixes must run before paint to beat React's selection restoration;
// fall back to useEffect during SSR where layout effects can't run.
const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

/**
 * Currency amount entry. Auto-formats as you type, with live comma grouping:
 *
 *   - `precision="cents"` — explicit decimal: digits are dollars (`1234` →
 *     `$1,234`), type `.` for cents (`.5` → `$1,234.5`), pads to two on blur
 *     (`$1,234.50`). For transactions, savings, per-paycheck income.
 *   - `precision="whole"` — integer dollars, comma-grouped, no decimal
 *     (`85000` → `$85,000`). For income baselines where cents are noise.
 *
 * Controlled on the canonical decimal string the forms already use (`value` /
 * `onChange`), so it drops into the existing form state. When `name` is set it
 * also emits a hidden field carrying that canonical value, so the server
 * receives `"1234.5"` / `"85000"` rather than the formatted display string. Omit
 * `name` where the parent submits a converted value itself (income yearly →
 * monthly) and just needs the entry value back via `onChange`.
 *
 * Two looks: `variant="display"` is the large centered showcase (the cents are
 * rendered smaller and lighter as a visual cue, with a focus underline and a
 * trailing icon-clear) — `size` tunes it to the host (`"lg"` for dialogs, `"md"`
 * for sidebars). `variant="field"` is the compact inline field that matches the
 * app's other form inputs; it has no clear control by design — the dense rows it
 * serves don't warrant one.
 */
export function AmountInput({
  value,
  onChange,
  precision = "cents",
  variant = "field",
  size = "lg",
  name,
  required,
  allowZero = false,
  autoFocus,
  id,
  ariaLabel,
  placeholder,
  maxDigits = 9,
  className,
}: {
  value: string;
  onChange: (canonical: string) => void;
  precision?: AmountPrecision;
  variant?: "display" | "field";
  /** Display-variant scale: "lg" (dialogs) or "md" (tighter hosts like sidebars). */
  size?: "lg" | "md";
  name?: string;
  required?: boolean;
  /**
   * When the value is empty, submit `"0"` instead of `""`. Sites where a zero
   * amount is valid (category targets: "track but no cap") opt in here.
   */
  allowZero?: boolean;
  autoFocus?: boolean;
  id?: string;
  ariaLabel?: string;
  placeholder?: string;
  maxDigits?: number;
  className?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const fallbackId = useId();
  const inputId = id ?? fallbackId;

  // Parent state stays "" while empty (so the placeholder shows and `required`
  // can fire); allowZero sites still *submit* "0" for a blank field via the
  // hidden input (category targets — "track but no cap").
  const isDisplay = variant === "display";
  const formatted = formatAmount(value, precision);
  const canonical = value !== "" ? value : allowZero ? "0" : "";
  const ph = placeholder ?? (precision === "whole" ? "$0" : "$0.00");

  // The field shows the grouped value directly; the display variant's input is
  // transparent (the spans below render the pretty value), so it carries the
  // raw canonical — no commas means nothing can shift the caret mid-entry.
  const inputValue = isDisplay ? value : formatted;

  // Pin the caret to the end after every edit. A layout effect (post-commit)
  // beats React's selection restoration, which would otherwise drop the caret
  // back into the middle of the grouped number on a fast keystroke. Skip while a
  // range is selected (select-all on focus) so we don't collapse it — during
  // typing the selection is already collapsed, which is the case that needs the
  // fix.
  useIsoLayoutEffect(() => {
    const el = ref.current;
    if (el && document.activeElement === el && el.selectionStart === el.selectionEnd) {
      el.setSelectionRange(el.value.length, el.value.length);
    }
  }, [inputValue]);

  const sharedInputProps = {
    ref,
    id: inputId,
    type: "text" as const,
    inputMode: (precision === "whole" ? "numeric" : "decimal") as "numeric" | "decimal",
    autoComplete: "off",
    "aria-label": ariaLabel,
    value: inputValue,
    required,
    autoFocus,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      onChange(sanitizeAmount(e.target.value, precision, maxDigits)),
    // Select the whole value on focus so the field behaves like a standard
    // amount entry: focus (click / tab / autoFocus) then type to overwrite, or
    // Backspace to clear back to the placeholder — no need to hunt for the ✕.
    onFocus: (e: React.FocusEvent<HTMLInputElement>) => e.target.select(),
    onBlur: () => onChange(padOnBlur(value, precision)),
  };

  if (!isDisplay) {
    return (
      <>
        <input
          {...sharedInputProps}
          placeholder={ph}
          className={cn(
            "w-full rounded-md bg-background px-2 py-1.5 text-right text-sm tabular-nums ring-1 ring-border outline-none focus:ring-ring",
            className,
          )}
        />
        {name && <input type="hidden" name={name} value={canonical} />}
      </>
    );
  }

  // Display variant: a transparent input over styled spans, so the cents can be
  // rendered smaller + lighter than the dollars. Span sizes are em-relative, so
  // `size` (the container font-size) scales the whole readout uniformly.
  const { dollars, cents } = formatAmountParts(value, precision);
  const isEmpty = dollars === "";

  return (
    <div className="w-full py-2">
      <label
        htmlFor={inputId}
        className={cn(
          "relative flex w-full cursor-text justify-center font-semibold tracking-tight tabular-nums",
          size === "lg" ? "text-5xl" : "text-3xl",
          className,
        )}
      >
        {/* Input is the `peer` sibling so focusing it underlines the number below
            — a visible focus signal the transparent overlay otherwise lacks. */}
        <input
          {...sharedInputProps}
          className="peer absolute inset-0 w-full cursor-text text-center text-transparent caret-transparent outline-none"
        />
        <span className="relative inline-flex items-baseline border-b-2 border-transparent pb-1 transition-colors peer-focus:border-ring">
          <span aria-hidden className="pointer-events-none">
            {isEmpty ? (
              <span className="text-muted-foreground/40">{ph}</span>
            ) : (
              <>
                {dollars}
                {cents && (
                  <span className="text-[0.5em] text-muted-foreground">{cents}</span>
                )}
              </>
            )}
          </span>
          {/* Trails the number (absolute, so it never shifts the centering);
              hidden + unfocusable until there's something to clear. */}
          <button
            type="button"
            aria-label="Clear amount"
            tabIndex={value === "" ? -1 : 0}
            onMouseDown={(e) => e.preventDefault()} // keep focus on the input
            onClick={() => {
              onChange("");
              ref.current?.focus();
            }}
            className={cn(
              "absolute left-full top-1/2 z-10 ml-3 grid size-7 -translate-y-1/2 place-items-center rounded-full text-muted-foreground/60 transition-opacity hover:bg-muted hover:text-foreground focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              value === "" ? "pointer-events-none opacity-0" : "opacity-100",
            )}
          >
            <X className="size-4" aria-hidden />
          </button>
        </span>
      </label>
      {name && <input type="hidden" name={name} value={canonical} />}
    </div>
  );
}
