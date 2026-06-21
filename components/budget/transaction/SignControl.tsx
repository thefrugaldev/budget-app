"use client";

import { cn } from "@/lib/utils";

/**
 * Two-button +/- toggle for a transaction's direction. Labels are
 * kind-aware (e.g. "Spent"/"Refund" for expenses, "In"/"Out" for savings)
 * and supplied by the parent via `signLabelsFor`.
 */
export function SignControl({
  labels,
  value,
  onChange,
}: {
  labels: { positive: string; negative: string };
  value: "+" | "-";
  onChange: (v: "+" | "-") => void;
}) {
  return (
    <div
      role="group"
      aria-label="Direction"
      className="inline-flex shrink-0 rounded-md bg-muted p-0.5 text-xs ring-1 ring-border"
    >
      <button
        type="button"
        onClick={() => onChange("+")}
        aria-pressed={value === "+"}
        className={cn(
          "rounded-[5px] px-2 py-1 font-medium transition-colors",
          value === "+"
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        {labels.positive}
      </button>
      <button
        type="button"
        onClick={() => onChange("-")}
        aria-pressed={value === "-"}
        className={cn(
          "rounded-[5px] px-2 py-1 font-medium transition-colors",
          value === "-"
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        {labels.negative}
      </button>
    </div>
  );
}
