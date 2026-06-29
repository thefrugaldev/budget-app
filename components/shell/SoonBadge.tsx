import { cn } from "@/lib/utils";

/**
 * "Soon" marker for nav destinations that aren't built yet (FIRE, Net worth).
 * Carries a real text label — not a color-only dot — so the upcoming status is
 * legible to assistive tech, per the accessibility baseline. Visual styling is
 * deliberately minimal; the identity pass (#80) can restyle it.
 */
export function SoonBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase leading-none tracking-wide text-muted-foreground",
        className,
      )}
    >
      Soon
    </span>
  );
}
