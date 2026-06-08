import type { CategoryKind } from "@/types/budget";
import { fmtExact } from "@/lib/budget";

/**
 * Renders a signed dollar amount with kind-aware sign conventions:
 *   - expense:  bare formatted value (positive = outflow, negative = refund)
 *   - savings/income: explicit `+` prefix when positive (contribution / income
 *     received); the formatter's own `-` carries negative cases.
 *
 * When `marker` is true (the default, used for category-scope totals on cards
 * and detail headers), prepends a `↓` glyph when the amount is negative — the
 * render-layer cue for a "backwards" period that the four-deep `ThresholdState`
 * deliberately doesn't encode.
 *
 * Pass `marker={false}` for per-transaction rows where the dollar sign and the
 * numeric sign already convey direction.
 */
export function SignedAmount({
  kind,
  amount,
  marker = true,
}: {
  kind: CategoryKind;
  amount: number;
  marker?: boolean;
}) {
  const isNegative = amount < 0;
  const showPlus = kind !== "expense" && amount > 0;
  return (
    <>
      {marker && isNegative && (
        <span aria-label="net negative" className="mr-1">
          ↓
        </span>
      )}
      {showPlus ? "+" : ""}
      {fmtExact(amount)}
    </>
  );
}
