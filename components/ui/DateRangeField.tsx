"use client";

import { Popover } from "@base-ui/react/popover";
import { format, isValid, parseISO } from "date-fns";
import { Calendar, X } from "lucide-react";
import { useState } from "react";
import { DayPicker, type DateRange } from "react-day-picker";

import { cn } from "@/lib/utils";

/**
 * Folds the two-input mm/dd/yyyy date range on the category-detail filter row
 * into a single popover. Controlled-only: pass `from` / `to` as YYYY-MM-DD
 * strings (or "" for empty) and `onChange` for the pair. Optional `name` props
 * mount hidden inputs so a parent form picks the values up via FormData.
 */
export type DateRangeFieldProps = {
  from: string;
  to: string;
  onChange: (next: { from: string; to: string }) => void;
  fromName?: string;
  toName?: string;
  ariaLabel?: string;
  placeholder?: string;
  className?: string;
};

function toDate(value: string): Date | undefined {
  if (!value) return undefined;
  const parsed = parseISO(value);
  return isValid(parsed) ? parsed : undefined;
}

function fmtRange(from: string, to: string, placeholder: string): string {
  const a = toDate(from);
  const b = toDate(to);
  if (a && b) return `${format(a, "MMM d, yyyy")} – ${format(b, "MMM d, yyyy")}`;
  if (a) return `${format(a, "MMM d, yyyy")} – …`;
  if (b) return `… – ${format(b, "MMM d, yyyy")}`;
  return placeholder;
}

export function DateRangeField({
  from,
  to,
  onChange,
  fromName,
  toName,
  ariaLabel = "Pick a date range",
  placeholder = "Any date",
  className,
}: DateRangeFieldProps) {
  const [open, setOpen] = useState(false);
  const selected: DateRange | undefined =
    from || to
      ? { from: toDate(from), to: toDate(to) }
      : undefined;
  const hasRange = Boolean(from || to);

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      {fromName !== undefined && (
        <input type="hidden" name={fromName} value={from} />
      )}
      {toName !== undefined && (
        <input type="hidden" name={toName} value={to} />
      )}
      <div className={cn("flex items-center gap-1", className)}>
        <Popover.Trigger
          aria-label={ariaLabel}
          className={cn(
            "flex flex-1 cursor-pointer items-center justify-between rounded-md bg-background px-2 py-1.5 text-sm ring-1 ring-border outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring",
            !hasRange && "text-muted-foreground",
          )}
        >
          <span>{fmtRange(from, to, placeholder)}</span>
          <Calendar className="size-3.5 text-muted-foreground" aria-hidden />
        </Popover.Trigger>
        {hasRange && (
          <button
            type="button"
            onClick={() => onChange({ from: "", to: "" })}
            aria-label="Clear date range"
            className="cursor-pointer rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="size-3.5" aria-hidden />
          </button>
        )}
      </div>
      <Popover.Portal>
        <Popover.Positioner
          sideOffset={6}
          align="start"
          collisionPadding={16}
          className="z-50"
        >
          <Popover.Popup
            aria-label="Calendar"
            className="rounded-xl bg-card p-2 shadow-xl ring-1 ring-border outline-none data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 transition-opacity"
          >
            <DayPicker
              mode="range"
              selected={selected}
              onSelect={(range) => {
                onChange({
                  from: range?.from ? format(range.from, "yyyy-MM-dd") : "",
                  to: range?.to ? format(range.to, "yyyy-MM-dd") : "",
                });
              }}
              numberOfMonths={2}
              showOutsideDays
            />
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
