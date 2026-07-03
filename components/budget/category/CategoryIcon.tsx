import { createElement } from "react";

import { LazyLucideIcon } from "@/components/budget/category/LazyLucideIcon";
import { DEFAULT_CATEGORY_ICON, staticIconFor } from "@/lib/category/icon";
import { cn } from "@/lib/utils";

/**
 * The palette-tinted lucide icon for a category, in its rounded tile (#80
 * chunk 4). Replaces the raw `{category.emoji}` glyph. The tile size is set by
 * `className` (e.g. `size-11` on the Pulse card, `size-12` on the detail
 * sidebar) and the glyph scales via `iconClassName`. Decorative — the category
 * name always sits alongside it, so the icon is `aria-hidden`.
 *
 * Curated icons render statically (instant, server-rendered). A category whose
 * chosen icon lives outside the curated set falls back to `LazyLucideIcon`,
 * which loads it from the full catalogue on demand.
 */
export function CategoryIcon({
  category,
  className,
  iconClassName,
}: {
  category: { icon?: string; emoji?: string };
  className?: string;
  iconClassName?: string;
}) {
  const Static = staticIconFor(category);
  const glyphClass = cn("size-5", iconClassName);
  return (
    <span
      className={cn(
        "grid size-11 shrink-0 place-items-center rounded-xl bg-muted text-foreground",
        className,
      )}
    >
      {Static
        ? createElement(Static, { "aria-hidden": true, className: glyphClass })
        : category.icon
          ? <LazyLucideIcon name={category.icon} className={glyphClass} />
          : createElement(DEFAULT_CATEGORY_ICON, {
              "aria-hidden": true,
              className: glyphClass,
            })}
    </span>
  );
}
