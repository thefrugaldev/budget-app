import { AlertTriangle } from "lucide-react";

import { longDateLabel } from "@/lib/budget";
import type { PricingStatus } from "@/types/net-worth";

/**
 * The "prices may be off" indicator (#109 chunk 6, story 19). Renders nothing
 * when prices are healthy; otherwise a text-bearing banner (never color alone —
 * the icon + words carry the meaning for colorblind / assistive-tech users, per
 * the a11y baseline). Two cases, unpriced taking precedence because it understates
 * the figure:
 *  - `unpriced` — a ticker has no price at all (feed failed, never cached); its
 *    holdings read as $0, so the net worth is understated. Points at the override.
 *  - `stale` — prices couldn't refresh and we're showing cached values as of the
 *    last successful fetch.
 */
export function PriceStalenessNotice({ status }: { status: PricingStatus }) {
  const { stale, unpriced, pricedAt } = status;
  if (!stale && unpriced.length === 0) return null;

  const message =
    unpriced.length > 0
      ? `Couldn't get a live price for ${unpriced.join(", ")} — those holdings are counted as $0, so your net worth is understated. Add a manual price override to fix it.`
      : `Live prices couldn't refresh${
          pricedAt ? ` — showing values as of ${longDateLabel(pricedAt.slice(0, 10))}` : ""
        }.`;

  return (
    <div className="mb-6 flex items-start gap-2.5 rounded-xl bg-muted px-4 py-3 text-sm text-muted-foreground">
      <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0 text-signal-warn-foreground" />
      <p>{message}</p>
    </div>
  );
}
