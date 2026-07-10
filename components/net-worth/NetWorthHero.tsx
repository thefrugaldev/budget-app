import { fmt } from "@/lib/budget";
import { cn } from "@/lib/utils";
import type { NetWorthHeadline } from "@/types/net-worth";

/**
 * The Net Worth page hero (#109 chunk 6, stories 1/2): the live net figure —
 * assets minus liabilities at current prices — in the display face, with both
 * subtotals beneath it. Mirrors the Pulse thesis hero so the two pages feel like
 * one product (story 20). The net leads neutral and only turns red when it goes
 * negative (underwater); the subtotals carry the good/bad signal tones so the
 * two sides are legible without relying on the net's color alone.
 */
export function NetWorthHero({ headline }: { headline: NetWorthHeadline }) {
  const { assets, liabilities, net } = headline;

  return (
    <header className="mb-8">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        Net worth
      </p>
      <h1
        className={cn(
          "mt-3 font-heading text-hero font-semibold tracking-tight tabular-nums",
          net < 0 ? "text-signal-bad-foreground" : "text-foreground",
        )}
      >
        {fmt(net)}
      </h1>
      <p className="mt-3 flex flex-wrap items-baseline gap-x-6 gap-y-1 text-base text-muted-foreground">
        <span>
          Assets{" "}
          <span className="font-medium tabular-nums text-signal-good-foreground">
            {fmt(assets)}
          </span>
        </span>
        <span>
          Liabilities{" "}
          <span className="font-medium tabular-nums text-signal-bad-foreground">
            {fmt(liabilities)}
          </span>
        </span>
      </p>
    </header>
  );
}
