import Link from "next/link";
import { RANGE_PRESETS, rangeLabel } from "@/lib/budget";
import type { RangePreset } from "@/types/range";
import { cn } from "@/lib/utils";

/**
 * Server component: renders the range preset chips as <Link>s that update
 * `?range=` on the current path. Soft navigation re-renders the page with
 * the new searchParams, so the whole page (KPIs + cards) reflows in one go
 * without a client boundary.
 */
export function RangeSelector({
  active,
  basePath,
}: {
  active: RangePreset;
  /** Path the chips link to. The detail page passes its own segment. */
  basePath: string;
}) {
  return (
    <nav
      aria-label="Time range"
      className="flex flex-wrap items-center gap-2"
    >
      {RANGE_PRESETS.map((preset) => {
        const isActive = preset === active;
        const href = preset === "this-month" ? basePath : `${basePath}?range=${preset}`;
        return (
          <Link
            key={preset}
            href={href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium ring-1 transition-colors",
              isActive
                ? "bg-foreground text-background ring-foreground"
                : "bg-card text-muted-foreground ring-border hover:text-foreground",
            )}
          >
            {rangeLabel(preset)}
          </Link>
        );
      })}
    </nav>
  );
}
