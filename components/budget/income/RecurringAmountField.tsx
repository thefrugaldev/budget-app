"use client";

import { AmountInput } from "@/components/budget/amount/AmountInput";
import { fmt, fmtExact } from "@/lib/budget";
import {
  cadenceLabel,
  paycheckFromYearly,
  yearlyFromPaycheck,
} from "@/lib/income";
import { cn } from "@/lib/utils";
import type { PayCadence } from "@/types/budget";

export type AmountUnit = "yearly" | "per-paycheck";

const UNITS: ReadonlyArray<{ value: AmountUnit; label: string }> = [
  { value: "yearly", label: "Yearly" },
  { value: "per-paycheck", label: "Per paycheck" },
];

/**
 * Amount entry for a recurring income source with a unit toggle (defaults to
 * yearly, switchable to per-paycheck). The two are the same baseline seen
 * through the cadence, so toggling converts the entered value rather than
 * clearing it, and a sub-line always echoes the other unit.
 *
 * Owns no state: the parent holds `{ unit, value }` (value is the amount in the
 * current unit's canonical string) and reads it back to submit whatever its
 * action expects — yearly for the editor, per-paycheck for the create dialog.
 * Switching unit reports the converted value alongside the new unit in one
 * `onChange`, so the parent never re-derives the conversion.
 *
 * Deliberately takes no `name` and renders no hidden input: the submitted field
 * differs per call site (the editor posts `yearly`, the dialog posts
 * `amountPerPaycheck`), so each parent owns its own hidden field and converts
 * `value` to it. A `targetUnit`/`name` prop here would just push that divergence
 * inward.
 */
export function RecurringAmountField({
  unit,
  value,
  cadence,
  onChange,
  autoFocus,
  id,
}: {
  unit: AmountUnit;
  value: string;
  cadence: PayCadence;
  /** Fires for both a value edit (unit unchanged) and a unit switch (value converted). */
  onChange: (next: { unit: AmountUnit; value: string }) => void;
  autoFocus?: boolean;
  id?: string;
}) {
  const amount = Number(value);
  const hasAmount = value !== "" && Number.isFinite(amount) && amount > 0;

  function switchTo(nextUnit: AmountUnit) {
    if (nextUnit === unit) return;
    let nextValue = "";
    if (hasAmount) {
      nextValue =
        nextUnit === "per-paycheck"
          ? paycheckFromYearly(amount, cadence).toFixed(2)
          : String(Math.round(yearlyFromPaycheck(amount, cadence)));
    }
    onChange({ unit: nextUnit, value: nextValue });
  }

  const preview = !hasAmount
    ? null
    : unit === "yearly"
      ? `≈ ${fmtExact(paycheckFromYearly(amount, cadence))} / paycheck (${cadenceLabel(cadence)})`
      : `≈ ${fmt(yearlyFromPaycheck(amount, cadence))} / yr`;

  return (
    <div className="space-y-1">
      <div className="flex justify-center">
        <div
          role="radiogroup"
          aria-label="Amount unit"
          className="inline-flex rounded-md bg-muted p-0.5 text-xs ring-1 ring-border"
        >
          {UNITS.map((u) => (
            <button
              key={u.value}
              type="button"
              role="radio"
              aria-checked={unit === u.value}
              onClick={() => switchTo(u.value)}
              className={cn(
                "rounded-[5px] px-3 py-1 font-medium transition-colors",
                unit === u.value
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {u.label}
            </button>
          ))}
        </div>
      </div>

      <AmountInput
        id={id}
        precision={unit === "yearly" ? "whole" : "cents"}
        variant="display"
        value={value}
        onChange={(v) => onChange({ unit, value: v })}
        required
        autoFocus={autoFocus}
        ariaLabel={unit === "yearly" ? "Yearly amount" : "Amount per paycheck"}
      />

      <p className="text-center text-xs text-muted-foreground tabular-nums">
        {preview ?? " "}
      </p>
    </div>
  );
}
