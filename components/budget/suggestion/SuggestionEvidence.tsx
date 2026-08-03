import { fmt, thresholdColor } from "@/lib/budget";
import { cn } from "@/lib/utils";
import type { Category } from "@/types/budget";
import type { TargetSuggestion } from "@/types/target-suggestion";

/**
 * The shared, text-carried evidence for a Target suggestion (#186): the typical
 * figure it derives from and the `Raise · $X → $Y/mo` before→after. Identical on
 * both surfaces (the Pulse card and the category-detail chart caption) so the
 * language never drifts between them — only the surrounding container differs.
 *
 * Direction is carried in the word "Raise"/"Lower" (and the arrow), never colour
 * alone; the chip tone comes from the *shared* signal source (`thresholdColor`)
 * so it agrees with the meter — a category over its stale cap reads `bad`, one
 * with comfortable headroom reads `good`. Colour is reinforcement only.
 */
export function SuggestionEvidence({
  suggestion,
  category,
}: {
  suggestion: TargetSuggestion;
  category: Category;
}) {
  const { direction, currentTarget, proposedTarget, median } = suggestion;
  const verb = direction === "raise" ? "Raise" : "Lower";
  const directionToneText = thresholdColor(
    category.kind,
    currentTarget,
    median,
  ).text;

  return (
    <>
      <p className="text-sm text-muted-foreground">
        Typically <span className="tabular-nums">{fmt(median)}</span>/mo over the
        last 6 months.
      </p>
      <p className="mt-1.5 flex items-center gap-1.5 text-sm font-medium">
        <span
          className={cn(
            "inline-flex shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs font-medium leading-none",
            directionToneText,
          )}
        >
          {verb}
        </span>
        <span>
          <span className="tabular-nums">{fmt(currentTarget)}</span>
          {" → "}
          <span className="tabular-nums">{fmt(proposedTarget)}</span>/mo
        </span>
      </p>
    </>
  );
}
