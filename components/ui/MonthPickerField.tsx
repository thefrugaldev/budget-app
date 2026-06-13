"use client";

import { Popover } from "@base-ui/react/popover";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";

import { cn } from "@/lib/utils";

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

const LONG_MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

/**
 * Replaces `<input type="month">` with a small popover: a year stepper at the
 * top and a 4×3 month grid. Wire format is the same `YYYY-MM` string the
 * native input emits.
 *
 * react-day-picker is day-grain — using its DayPicker for a month-only
 * field would force the user to click a day and we'd silently snap to the
 * 1st. A purpose-built 12-cell grid reads more clearly for "Active from"
 * and "Effective from" fields where days don't apply.
 */
export type MonthPickerFieldProps = {
  value: string; // YYYY-MM or ""
  onChange: (next: string) => void;
  name?: string;
  required?: boolean;
  ariaLabel?: string;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
};

function parseValue(value: string): { year: number; month: number } | null {
  const match = /^(\d{4})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1; // 0-indexed
  if (month < 0 || month > 11) return null;
  return { year, month };
}

function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

export function MonthPickerField({
  value,
  onChange,
  name,
  required,
  ariaLabel = "Pick a month",
  placeholder = "Pick a month",
  className,
  disabled,
}: MonthPickerFieldProps) {
  const [open, setOpen] = useState(false);
  const parsed = parseValue(value);
  const today = new Date();
  const fallbackYear = today.getFullYear();
  const [year, setYear] = useState<number>(parsed?.year ?? fallbackYear);

  const triggerLabel = parsed
    ? `${LONG_MONTHS[parsed.month]} ${parsed.year}`
    : placeholder;

  return (
    <Popover.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        // Re-anchor the year-stepper to the selected value (or today) every
        // time the popover opens, so a stale stepper position from a prior
        // visit doesn't surprise the user.
        if (next) setYear(parsed?.year ?? fallbackYear);
      }}
    >
      {name !== undefined && (
        <input type="hidden" name={name} value={value} required={required} />
      )}
      <Popover.Trigger
        aria-label={ariaLabel}
        disabled={disabled}
        className={cn(
          "flex w-full cursor-pointer items-center justify-between rounded-md bg-background px-2 py-1.5 text-sm ring-1 ring-border outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
          !parsed && "text-muted-foreground",
          className,
        )}
      >
        <span>{triggerLabel}</span>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner
          sideOffset={6}
          align="start"
          collisionPadding={16}
          className="z-50"
        >
          <Popover.Popup
            aria-label="Month picker"
            className="w-56 rounded-xl bg-card p-2 shadow-xl ring-1 ring-border outline-none data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 transition-opacity"
          >
            <div className="mb-2 flex items-center justify-between">
              <button
                type="button"
                aria-label="Previous year"
                onClick={() => setYear((y) => y - 1)}
                className="cursor-pointer rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <ChevronLeft className="size-4" aria-hidden />
              </button>
              <span className="text-sm font-semibold">{year}</span>
              <button
                type="button"
                aria-label="Next year"
                onClick={() => setYear((y) => y + 1)}
                className="cursor-pointer rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <ChevronRight className="size-4" aria-hidden />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-1">
              {MONTHS.map((label, idx) => {
                const isSelected =
                  parsed?.year === year && parsed.month === idx;
                return (
                  <button
                    key={label}
                    type="button"
                    aria-label={`${LONG_MONTHS[idx]} ${year}`}
                    aria-pressed={isSelected}
                    onClick={() => {
                      onChange(`${year}-${pad2(idx + 1)}`);
                      setOpen(false);
                    }}
                    className={cn(
                      "cursor-pointer rounded-md px-2 py-1.5 text-xs font-medium ring-1 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                      isSelected
                        ? "bg-primary text-primary-foreground ring-primary"
                        : "bg-background text-foreground ring-border hover:bg-muted",
                    )}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
