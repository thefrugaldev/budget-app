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
 *
 * The page-subject ("Net worth") is the `<h1>`, not the amount — a screen reader
 * announcing the heading says what the page is about rather than a bare figure;
 * the figure sits beneath as a decorated non-heading (a11y baseline).
 */
export function NetWorthHero({ headline }: { headline: NetWorthHeadline }) {
  const { assets, liabilities, net } = headline;

  return (
    <header className="mb-8">
      <h1 className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        Net worth
      </h1>
      <p
        className={cn(
          "mt-2 font-heading text-hero font-bold tracking-tight tabular-nums",
          net < 0 ? "text-signal-bad-foreground" : "text-foreground",
        )}
      >
        {fmt(net)}
      </p>
      {/* Supporting split — deliberately a step down in size/weight from the net
          so the marquee figure reads first; the good/bad tones stay to keep the
          two sides legible at a glance. */}
      <p className="mt-4 flex flex-wrap items-baseline gap-x-5 gap-y-1 text-sm text-muted-foreground">
        <span>
          Assets{" "}
          <span className="font-semibold tabular-nums text-signal-good-foreground">
            {fmt(assets)}
          </span>
        </span>
        <span>
          Liabilities{" "}
          <span className="font-semibold tabular-nums text-signal-bad-foreground">
            {fmt(liabilities)}
          </span>
        </span>
      </p>
    </header>
  );
}
