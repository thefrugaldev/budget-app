"use client";

import { cadenceLabel } from "@/lib/income";
import { cn } from "@/lib/utils";
import type { PayCadence } from "@/types/budget";

const CADENCES: readonly PayCadence[] = [
  "weekly",
  "bi-weekly",
  "semi-monthly",
  "monthly",
];

/**
 * Controlled segmented control for picking a recurring source's pay cadence.
 * Shared infrastructure: used by the two-step Add form (chunk 3) and the
 * inline editor (chunk 7), so it lives in the income module rather than
 * co-located with either caller. Posts the selected value through a hidden
 * input named `name` (default `"cadence"`), so it drops into any `<form>`
 * driven by a server action without extra wiring.
 */
export function CadenceField({
  value,
  onChange,
  name = "cadence",
  ariaLabel = "Pay cadence",
}: {
  value: PayCadence;
  onChange: (next: PayCadence) => void;
  name?: string;
  ariaLabel?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className="grid grid-cols-2 gap-1.5 sm:grid-cols-4"
    >
      {CADENCES.map((cadence) => {
        const selected = cadence === value;
        return (
          <button
            key={cadence}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(cadence)}
            className={cn(
              "rounded-md px-2 py-1.5 text-xs font-medium capitalize ring-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              selected
                ? "bg-primary text-primary-foreground ring-primary"
                : "bg-background text-muted-foreground ring-border hover:bg-muted hover:text-foreground",
            )}
          >
            {cadenceLabel(cadence)}
          </button>
        );
      })}
      <input type="hidden" name={name} value={value} />
    </div>
  );
}
