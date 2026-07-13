"use client";

import { useActionState, useId, useState } from "react";

import { addHoldingAction } from "@/app/actions/net-worth";
import { NET_WORTH_ACTION_INITIAL } from "@/app/actions/net-worth-state";
import { AmountInput } from "@/components/budget/amount/AmountInput";
import { TickerCombobox } from "@/components/net-worth/TickerCombobox";
import { FormSubmitButton } from "@/components/ui/FormSubmitButton";
import { useActionSuccessToast } from "@/hooks/useActionSuccessToast";

/**
 * Add a position to an investment account (#109 chunk 7, story 4). Ticker +
 * quantity (a plain decimal input, story 23) + an optional manual price override
 * (the shared currency `AmountInput`, story 12 — blank means "use the live
 * feed"). Clears itself on success so a second position can be added straight
 * away. Wraps chunk 5's `addHoldingAction`, which rejects a duplicate ticker.
 */
export function AddHoldingForm({
  accountId,
  onCancel,
}: {
  accountId: string;
  onCancel?: () => void;
}) {
  const [state, formAction] = useActionState(addHoldingAction, NET_WORTH_ACTION_INITIAL);
  const tickerId = useId();
  const [ticker, setTicker] = useState("");
  const [quantity, setQuantity] = useState("");
  const [priceOverride, setPriceOverride] = useState("");
  // Override is opt-in: hidden until asked for, so the common path is just
  // ticker + quantity and the manual price reads as a deliberate exception.
  const [showOverride, setShowOverride] = useState(false);

  useActionSuccessToast(state, () => "Holding added", () => {
    setTicker("");
    setQuantity("");
    setPriceOverride("");
    setShowOverride(false);
  });

  return (
    <form action={formAction} className="space-y-2 rounded-lg bg-muted/50 p-3">
      <input type="hidden" name="accountId" value={accountId} />
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex-1 space-y-1">
          <label htmlFor={tickerId} className="block text-[11px] font-medium text-muted-foreground">
            Ticker
          </label>
          <TickerCombobox
            name="ticker"
            id={tickerId}
            value={ticker}
            onChange={setTicker}
            // onChange tracks free typing; onSelect fires only on a chosen suggestion.
            // Both set the ticker today (so a click fills the field either way); onSelect
            // is the seam where chunk 2 hangs its price-check, which is why they're distinct.
            onSelect={setTicker}
            required
            ariaLabel="Ticker"
          />
        </div>
        <label className="flex-1 space-y-1">
          <span className="block text-[11px] font-medium text-muted-foreground">Quantity</span>
          <input
            name="quantity"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            inputMode="decimal"
            placeholder="Shares"
            required
            aria-label="Quantity"
            autoComplete="off"
            className="w-full rounded-md bg-background px-2 py-1.5 text-right text-sm tabular-nums ring-1 ring-border outline-none focus:ring-ring"
          />
        </label>
      </div>
      {showOverride ? (
        <label className="block space-y-1">
          <span className="block text-[11px] font-medium text-muted-foreground">
            Manual price — use when the feed can&rsquo;t quote this ticker
          </span>
          <AmountInput
            name="priceOverride"
            precision="cents"
            variant="field"
            value={priceOverride}
            onChange={setPriceOverride}
            ariaLabel="Manual price override"
            autoFocus
          />
        </label>
      ) : (
        <button
          type="button"
          onClick={() => setShowOverride(true)}
          className="text-xs font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        >
          + Set a manual price
        </button>
      )}

      {state.error && (
        <p role="alert" className="text-xs text-destructive">
          {state.error}
        </p>
      )}

      <div className="flex justify-end gap-2">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            Cancel
          </button>
        )}
        <FormSubmitButton label="Add holding" pendingLabel="Adding…" variant="compact" />
      </div>
    </form>
  );
}
