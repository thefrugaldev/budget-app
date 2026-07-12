"use client";

import { useId } from "react";

import { cn } from "@/lib/utils";

/**
 * A labeled numeric knob for the assumptions panel (#110 chunk 4) — percents
 * (return, inflation, SWR) and whole counts (birth year, retirement age). The
 * unit lives in the `label` ("Expected return (%)") rather than an overlaid
 * suffix, so it never collides with the right-aligned value and reaches screen
 * readers as part of the field name. Controlled on a raw string (the server
 * parser validates), and always carries a `name` so the form submits it.
 */
export function NumberKnob({
  label,
  name,
  value,
  onChange,
  placeholder,
  hint,
  inputMode = "decimal",
  className,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Optional helper line under the field (e.g. the derived real rate). */
  hint?: string;
  inputMode?: "decimal" | "numeric";
  className?: string;
}) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  return (
    <div className={className}>
      <label htmlFor={id} className="block text-xs font-medium text-muted-foreground">
        {label}
      </label>
      <input
        id={id}
        name={name}
        type="text"
        inputMode={inputMode}
        autoComplete="off"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        aria-describedby={hintId}
        className={cn(
          "mt-1 w-full rounded-md bg-background px-2 py-1.5 text-right text-sm tabular-nums",
          "ring-1 ring-border outline-none focus-visible:ring-2 focus-visible:ring-ring",
        )}
      />
      {hint && (
        <p id={hintId} className="mt-1 text-right text-xs text-muted-foreground tabular-nums">
          {hint}
        </p>
      )}
    </div>
  );
}
