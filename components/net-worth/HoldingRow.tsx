"use client";

import { Pencil, Trash2 } from "lucide-react";
import { useActionState, useState } from "react";

import { removeHoldingAction, updateHoldingAction } from "@/app/actions/net-worth";
import { NET_WORTH_ACTION_INITIAL } from "@/app/actions/net-worth-state";
import { AmountInput } from "@/components/budget/amount/AmountInput";
import { FormSubmitButton } from "@/components/ui/FormSubmitButton";
import { useActionSuccessToast } from "@/hooks/useActionSuccessToast";
import { fmt } from "@/lib/budget";
import type { Holding } from "@/types/net-worth";

/**
 * One holding in the edit sheet's holdings editor (#109 chunk 7, story 18): a
 * read row (ticker · quantity · override) with inline Edit and Remove. Ticker is
 * the identity key, so editing changes quantity / override only — to rename a
 * position, remove it and add the new one. Each control is its own tiny form
 * wired to chunk 5's `updateHoldingAction` / `removeHoldingAction`.
 */
export function HoldingRow({ accountId, holding }: { accountId: string; holding: Holding }) {
  const [editing, setEditing] = useState(false);
  const [quantity, setQuantity] = useState(String(holding.quantity));
  const [priceOverride, setPriceOverride] = useState(
    holding.priceOverride !== undefined ? String(holding.priceOverride) : "",
  );

  // Resync local inputs when the persisted holding actually changes (an update
  // landed and the page revalidated) — compared by value, not identity, so an
  // unrelated re-render doesn't clobber an in-progress edit.
  const holdingKey = `${holding.ticker}|${holding.quantity}|${holding.priceOverride ?? ""}`;
  const [prevKey, setPrevKey] = useState(holdingKey);
  if (prevKey !== holdingKey) {
    setPrevKey(holdingKey);
    setQuantity(String(holding.quantity));
    setPriceOverride(holding.priceOverride !== undefined ? String(holding.priceOverride) : "");
  }

  const [updateState, updateAction] = useActionState(updateHoldingAction, NET_WORTH_ACTION_INITIAL);
  const [removeState, removeAction] = useActionState(removeHoldingAction, NET_WORTH_ACTION_INITIAL);
  useActionSuccessToast(updateState, () => `${holding.ticker} updated`, () => setEditing(false));
  useActionSuccessToast(removeState, () => `${holding.ticker} removed`);

  if (!editing) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-md px-1 py-1.5">
        <div className="min-w-0">
          <span className="font-medium">{holding.ticker}</span>
          <span className="ml-2 text-xs text-muted-foreground tabular-nums">
            {holding.quantity} shares
            {holding.priceOverride !== undefined && ` · ${fmt(holding.priceOverride)} override`}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => setEditing(true)}
            aria-label={`Edit ${holding.ticker}`}
            className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Pencil className="size-3.5" aria-hidden />
          </button>
          <form action={removeAction}>
            <input type="hidden" name="accountId" value={accountId} />
            <input type="hidden" name="ticker" value={holding.ticker} />
            <button
              type="submit"
              aria-label={`Remove ${holding.ticker}`}
              className="rounded-md p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Trash2 className="size-3.5" aria-hidden />
            </button>
          </form>
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
      <div className="flex items-center justify-between">
        <span className="font-medium">{holding.ticker}</span>
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex-1 space-y-1">
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
        <label className="flex-1 space-y-1">
          <span className="block text-[11px] font-medium text-muted-foreground">Override</span>
          <AmountInput
            name="priceOverride"
            precision="cents"
            variant="field"
            value={priceOverride}
            onChange={setPriceOverride}
            ariaLabel={`${holding.ticker} price override`}
            placeholder="Feed price"
          />
        </label>
      </div>
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
