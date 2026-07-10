"use client";

import { Pencil, Trash2 } from "lucide-react";
import { useActionState, useState } from "react";

import { removeHoldingAction, updateHoldingAction } from "@/app/actions/net-worth";
import { NET_WORTH_ACTION_INITIAL } from "@/app/actions/net-worth-state";
import { AmountInput } from "@/components/budget/amount/AmountInput";
import { FormSubmitButton } from "@/components/ui/FormSubmitButton";
import { useActionSuccessToast } from "@/hooks/useActionSuccessToast";
import { useResyncOnChange } from "@/hooks/useResyncOnChange";
import { fmt, fmtExact } from "@/lib/budget";
import type { Holding } from "@/types/net-worth";

/**
 * One holding in the edit sheet's holdings editor (#109 chunk 7, story 18): a
 * read row (ticker · quantity · value) with inline Edit and Remove. Ticker is
 * the identity key, so editing changes quantity / override only — to rename a
 * position, remove it and add the new one.
 *
 * The row shows its **current value** (quantity × the price actually used: a
 * manual override, else the live feed) so the list is informative, not just
 * share counts. A holding the feed can't price and that has no override shows
 * "No price yet" — the per-position half of the staleness story (story 19),
 * pointing at the override. `feedPrice` is the resolved live price for the
 * ticker, threaded from the page.
 */
export function HoldingRow({
  accountId,
  holding,
  feedPrice,
}: {
  accountId: string;
  holding: Holding;
  feedPrice?: number;
}) {
  const [editing, setEditing] = useState(false);
  const [quantity, setQuantity] = useState(String(holding.quantity));
  const [priceOverride, setPriceOverride] = useState(
    holding.priceOverride !== undefined ? String(holding.priceOverride) : "",
  );
  const [showOverride, setShowOverride] = useState(holding.priceOverride !== undefined);
  // A misclicked Trash irrecoverably drops the position (and any manual price the
  // user set), so gate it behind a lightweight inline confirm — lighter than the
  // account-level type-to-confirm, but no longer a one-click data loss.
  const [confirmingRemove, setConfirmingRemove] = useState(false);

  // Resync local inputs when the persisted holding actually changes (an update
  // landed and the page revalidated) — keyed by value, so an unrelated re-render
  // doesn't clobber an in-progress edit.
  useResyncOnChange(`${holding.ticker}|${holding.quantity}|${holding.priceOverride ?? ""}`, () => {
    setQuantity(String(holding.quantity));
    setPriceOverride(holding.priceOverride !== undefined ? String(holding.priceOverride) : "");
    setShowOverride(holding.priceOverride !== undefined);
  });

  const [updateState, updateAction] = useActionState(updateHoldingAction, NET_WORTH_ACTION_INITIAL);
  const [removeState, removeAction] = useActionState(removeHoldingAction, NET_WORTH_ACTION_INITIAL);
  useActionSuccessToast(updateState, () => `${holding.ticker} updated`, () => setEditing(false));
  useActionSuccessToast(removeState, () => `${holding.ticker} removed`);

  if (!editing) {
    const effectivePrice = holding.priceOverride ?? feedPrice;
    const value = effectivePrice !== undefined ? holding.quantity * effectivePrice : undefined;
    return (
      <div className="flex items-center justify-between gap-2 py-2">
        <div className="min-w-0">
          <span className="font-medium">{holding.ticker}</span>
          <span className="ml-2 text-xs text-muted-foreground tabular-nums">
            {holding.quantity} shares
            {effectivePrice !== undefined &&
              ` @ ${fmtExact(effectivePrice)}${holding.priceOverride !== undefined ? " manual" : ""}`}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {value !== undefined ? (
            <span className="text-sm font-medium tabular-nums">{fmt(value)}</span>
          ) : (
            <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-signal-warn-foreground">
              No price yet
            </span>
          )}
          {confirmingRemove ? (
            <form action={removeAction} className="flex items-center gap-1">
              <input type="hidden" name="accountId" value={accountId} />
              <input type="hidden" name="ticker" value={holding.ticker} />
              <span className="text-xs text-muted-foreground">Remove?</span>
              <button
                type="submit"
                className="rounded-md px-1.5 py-0.5 text-xs font-medium text-destructive hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Yes
              </button>
              <button
                type="button"
                onClick={() => setConfirmingRemove(false)}
                className="rounded-md px-1.5 py-0.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                No
              </button>
            </form>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setEditing(true)}
                aria-label={`Edit ${holding.ticker}`}
                className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Pencil className="size-3.5" aria-hidden />
              </button>
              <button
                type="button"
                onClick={() => setConfirmingRemove(true)}
                aria-label={`Remove ${holding.ticker}`}
                className="rounded-md p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Trash2 className="size-3.5" aria-hidden />
              </button>
            </>
          )}
        </div>
        {removeState.error && (
          <p role="alert" className="text-xs text-destructive">
            {removeState.error}
          </p>
        )}
      </div>
    );
  }

  return (
    <form action={updateAction} className="space-y-2 rounded-md bg-muted/50 p-2">
      <input type="hidden" name="accountId" value={accountId} />
      <input type="hidden" name="ticker" value={holding.ticker} />
      <span className="font-medium">{holding.ticker}</span>
      <label className="block space-y-1">
        <span className="block text-[11px] font-medium text-muted-foreground">Quantity</span>
        <input
          name="quantity"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          inputMode="decimal"
          required
          aria-label={`${holding.ticker} quantity`}
          autoComplete="off"
          className="w-full rounded-md bg-background px-2 py-1.5 text-right text-sm tabular-nums ring-1 ring-border outline-none focus:ring-ring"
        />
      </label>
      {showOverride ? (
        <label className="block space-y-1">
          <span className="block text-[11px] font-medium text-muted-foreground">
            Manual price — blank clears it and returns to the live feed
          </span>
          <AmountInput
            name="priceOverride"
            precision="cents"
            variant="field"
            value={priceOverride}
            onChange={setPriceOverride}
            ariaLabel={`${holding.ticker} price override`}
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
      {updateState.error && (
        <p role="alert" className="text-xs text-destructive">
          {updateState.error}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="rounded-md px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          Cancel
        </button>
        <FormSubmitButton label="Save" pendingLabel="Saving…" variant="compact" />
      </div>
    </form>
  );
}
