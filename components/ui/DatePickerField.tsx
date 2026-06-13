"use client";

import { Popover } from "@base-ui/react/popover";
import { format, isValid, parseISO } from "date-fns";
import { Calendar } from "lucide-react";
import { useState } from "react";
import { DayPicker } from "react-day-picker";

import { cn } from "@/lib/utils";

/**
 * Replaces `<input type="date">` with a Base UI popover wrapping
 * react-day-picker. The wire format is the same `YYYY-MM-DD` string the
 * native input emits, so consumers swap with no changes to the surrounding
 * server-action contract.
 *
 * Controlled-only: pass `value` (or `""` for empty) and `onChange`. A hidden
 * `<input name>` carries the value into the parent form's FormData.
 */
export type DatePickerFieldProps = {
  value: string; // YYYY-MM-DD or ""
  onChange: (next: string) => void;
  name?: string;
  required?: boolean;
  ariaLabel?: string;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
};

function toDate(value: string): Date | undefined {
  if (!value) return undefined;
  const parsed = parseISO(value);
  return isValid(parsed) ? parsed : undefined;
}

export function DatePickerField({
  value,
  onChange,
  name,
  required,
  ariaLabel = "Pick a date",
  placeholder = "Pick a date",
  className,
  disabled,
}: DatePickerFieldProps) {
  const [open, setOpen] = useState(false);
  const selected = toDate(value);

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      {name !== undefined && (
        // The hidden input lets a parent `<form action={...}>` pick the value
        // up via FormData. `required` mirrors the native attribute so the
        // browser surfaces an empty-field validation message the same way.
        <input type="hidden" name={name} value={value} required={required} />
      )}
      <Popover.Trigger
        aria-label={ariaLabel}
        disabled={disabled}
        className={cn(
          "flex w-full cursor-pointer items-center justify-between rounded-md bg-background px-2 py-1.5 text-sm ring-1 ring-border outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
          !selected && "text-muted-foreground",
          className,
        )}
      >
        <span>{selected ? format(selected, "MMM d, yyyy") : placeholder}</span>
        <Calendar className="size-3.5 text-muted-foreground" aria-hidden />
      </Popover.Trigger>
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
              mode="single"
              selected={selected}
              onSelect={(day) => {
                onChange(day ? format(day, "yyyy-MM-dd") : "");
                if (day) setOpen(false);
              }}
              showOutsideDays
            />
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
