import { createElement } from "react";

import { resolveCategoryIcon } from "@/lib/category/icon";
import { cn } from "@/lib/utils";

/**
 * The palette-tinted lucide icon for a category, in its rounded tile (#80
 * chunk 4). Replaces the raw `{category.emoji}` glyph. The tile size is set by
 * `className` (e.g. `size-11` on the Pulse card, `size-12` on the detail
 * sidebar) and the glyph scales via `iconClassName`. Decorative — the category
 * name always sits alongside it, so the icon is `aria-hidden`.
 */
export function CategoryIcon({
  category,
  className,
  iconClassName,
}: {
  category: { emoji: string };
  className?: string;
  iconClassName?: string;
}) {
  // createElement (not `<Icon/>`): the resolver returns a stable module-level
  // component, but binding it to a capitalized const trips the compiler's
  // static-components lint. Rendering it directly keeps the reference dynamic
  // without the false positive.
  return (
    <span
      className={cn(
        "grid size-11 shrink-0 place-items-center rounded-xl bg-muted text-foreground",
        className,
      )}
    >
      {createElement(resolveCategoryIcon(category), {
        "aria-hidden": true,
        className: cn("size-5", iconClassName),
      })}
    </span>
  );
}
