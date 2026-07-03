import Link from "next/link";

import { CategoryIcon } from "@/components/budget/category/CategoryIcon";
import { cn } from "@/lib/utils";
import type { Category } from "@/types/budget";

/**
 * Compact emoji + name chip identifying a transaction's category on the global
 * `/transactions` list (issue #17 chunk 5, story 19), where per-category
 * context is gone. Links to the category detail page so the chip doubles as
 * navigation; pass `asLink={false}` for contexts where a nested anchor would
 * be invalid (e.g. inside another interactive control).
 */
export function CategoryPill({
  category,
  asLink = true,
  className,
}: {
  category: Category;
  asLink?: boolean;
  className?: string;
}) {
  const classes = cn(
    "inline-flex max-w-[10rem] shrink-0 items-center gap-1 rounded-full bg-muted px-1.5 py-0.5 text-xs text-muted-foreground ring-1 ring-border",
    asLink && "transition-colors hover:text-foreground hover:ring-foreground/30",
    className,
  );
  const content = (
    <>
      <CategoryIcon
        category={category}
        className="size-3.5 rounded-none bg-transparent text-current"
        iconClassName="size-3.5"
      />
      <span className="truncate">{category.name}</span>
    </>
  );

  if (!asLink) {
    return (
      <span className={classes}>
        <span className="sr-only">Category: </span>
        {content}
      </span>
    );
  }

  return (
    <Link
      href={`/categories/${category.id}`}
      className={cn(
        classes,
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      )}
    >
      <span className="sr-only">Category: </span>
      {content}
    </Link>
  );
}
