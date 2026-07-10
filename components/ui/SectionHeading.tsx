import type { ReactNode } from "react";

/**
 * A muted, uppercase section label with an optional trailing figure — the row
 * that captions each card grid (Pulse's "Expenses · this month", Net Worth's
 * "Cash"/"Investments"). Extracted to a shared home because both surfaces need
 * the identical unit; the trailing `amount` is optional so a section without a
 * subtotal just renders the label. Presentation only — callers format the
 * amount string (currency, sign) before passing it in.
 */
export function SectionHeading({
  children,
  amount,
}: {
  children: ReactNode;
  amount?: string;
}) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-3">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {children}
      </h2>
      {amount && (
        <span className="font-heading text-sm font-semibold tabular-nums text-muted-foreground">
          {amount}
        </span>
      )}
    </div>
  );
}
