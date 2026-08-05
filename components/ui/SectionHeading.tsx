import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * A section label with an optional trailing figure — the row that captions each
 * card grid (Pulse's "Expenses · this month", Net Worth's "Assets"/"Liabilities").
 * Extracted to a shared home because both surfaces need the identical unit; the
 * trailing `amount` is optional so a section without a subtotal just renders the
 * label. Presentation only — callers format the amount string (currency, sign)
 * before passing it in.
 *
 * `variant` picks the weight:
 * - `"eyebrow"` (default) — a quiet, muted uppercase caption. What Pulse and FIRE use.
 * - `"divider"` — a dominant, ruled header for a section that groups *sub-headed*
 *   content beneath it (Net Worth's Assets/Liabilities over institution groups),
 *   so the section clearly outranks its `<h3>` groups instead of competing with them.
 */
export function SectionHeading({
  children,
  amount,
  variant = "eyebrow",
}: {
  children: ReactNode;
  amount?: string;
  variant?: "eyebrow" | "divider";
}) {
  const divider = variant === "divider";
  return (
    <div
      className={cn(
        "flex items-baseline justify-between gap-3",
        divider ? "mb-4 border-b border-border pb-2" : "mb-3",
      )}
    >
      <h2
        className={cn(
          "font-semibold uppercase tracking-wide",
          divider ? "text-sm text-foreground" : "text-xs text-muted-foreground",
        )}
      >
        {children}
      </h2>
      {amount && (
        <span
          className={cn(
            "font-heading text-sm font-semibold tabular-nums",
            divider ? "text-foreground" : "text-muted-foreground",
          )}
        >
          {amount}
        </span>
      )}
    </div>
  );
}
