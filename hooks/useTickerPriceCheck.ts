"use client";

import { useRef, useState } from "react";

import { lookupTickerPriceAction } from "@/app/actions/net-worth";

/**
 * The result of price-checking a chosen ticker (#144 chunk 2): `idle` before any
 * selection, `checking` while the lookup is in flight, then `priced` with the
 * live per-share price, or `unpriced` when the feed can't quote it (the cue to
 * reveal the manual-price override).
 */
export type TickerPriceCheck =
  | { status: "idle" }
  | { status: "checking"; ticker: string }
  | { status: "priced"; ticker: string; price: number }
  | { status: "unpriced"; ticker: string };

/**
 * Price-check a ticker the moment it's chosen from the add-holding combobox
 * (#144 chunk 2). One lookup per *selection*, not per keystroke — that would burn
 * Tiingo's quota — and a sequence guard drops a slow earlier response that lands
 * after a newer selection, so the shown price always matches the current ticker.
 * `reset` clears back to idle and invalidates any in-flight check — call it when
 * the ticker text is edited by hand or the form clears.
 *
 * `onUnpriced` fires once a check resolves with no live price — the caller's cue
 * to reveal the manual-price override. It runs from the async result, not a
 * render effect, so the reveal is a one-shot response to the outcome. `check` and
 * `reset` are plain event handlers (never used as effect deps), so they close
 * over the latest `onUnpriced` directly — no ref or memoization needed.
 */
export function useTickerPriceCheck(onUnpriced?: () => void): {
  state: TickerPriceCheck;
  check: (ticker: string) => void;
  reset: () => void;
} {
  const [state, setState] = useState<TickerPriceCheck>({ status: "idle" });
  const seq = useRef(0);

  function check(ticker: string) {
    const t = ticker.trim().toUpperCase();
    if (t === "") {
      seq.current++; // nothing to check; drop any in-flight result
      setState({ status: "idle" });
      return;
    }
    const mySeq = ++seq.current;
    setState({ status: "checking", ticker: t });
    const markUnpriced = () => {
      setState({ status: "unpriced", ticker: t });
      onUnpriced?.();
    };
    lookupTickerPriceAction(t)
      .then((price) => {
        // A newer selection (or a reset) has superseded this lookup — drop it.
        if (mySeq !== seq.current) return;
        if (price === null) markUnpriced();
        else setState({ status: "priced", ticker: t, price });
      })
      .catch(() => {
        // The action already degrades to null; this only covers a transport-level
        // rejection. Treat it as unpriced so the override nudge still appears.
        if (mySeq === seq.current) markUnpriced();
      });
  }

  function reset() {
    seq.current++; // invalidate any in-flight check so its result is ignored
    setState({ status: "idle" });
  }

  return { state, check, reset };
}
