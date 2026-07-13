"use client";

import { useActionState, useId, useState } from "react";

import { addHoldingAction } from "@/app/actions/net-worth";
import { NET_WORTH_ACTION_INITIAL } from "@/app/actions/net-worth-state";
import { AmountInput } from "@/components/budget/amount/AmountInput";
import { TickerCombobox } from "@/components/net-worth/TickerCombobox";
import { FormSubmitButton } from "@/components/ui/FormSubmitButton";
import { useActionSuccessToast } from "@/hooks/useActionSuccessToast";
import { useTickerPriceCheck } from "@/hooks/useTickerPriceCheck";
import { fmtExact } from "@/lib/budget";

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
  // A chosen ticker the feed can't price reveals the manual-price field — the
  // coverage-match nudge (#145): you picked a symbol we can't quote, so set a
  // price now. Reveal-only; never auto-hidden, so a price typed here isn't yanked
  // away if the ticker later changes.
  const priceCheck = useTickerPriceCheck(() => setShowOverride(true));

  useActionSuccessToast(state, () => "Holding added", () => {
    setTicker("");
    setQuantity("");
    setPriceOverride("");
    setShowOverride(false);
    priceCheck.reset();
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
            // onChange tracks the field and clears a stale price check as the text
            // changes; onSelect fires only on a chosen suggestion, where we
            // price-check that one symbol (chunk 2 coverage matching).
            onChange={(v) => {
              setTicker(v);
              priceCheck.reset();
            }}
            onSelect={priceCheck.check}
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

      {/* Price-check feedback for the chosen ticker (announced politely so a
          screen-reader user hears the live price or the "no price" nudge). */}
      <div aria-live="polite" className="min-h-4 text-xs">
        {priceCheck.state.status === "checking" && (
          <p className="text-muted-foreground">Checking live price…</p>
        )}
        {priceCheck.state.status === "priced" && (
          <p className="text-muted-foreground">
            Live price{" "}
            <span className="font-medium tabular-nums text-foreground">
              {fmtExact(priceCheck.state.price)}
            </span>{" "}
            per share
          </p>
        )}
        {priceCheck.state.status === "unpriced" && (
          <p className="text-signal-warn-foreground">
            No live price for {priceCheck.state.ticker} — add a manual price below.
          </p>
        )}
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
