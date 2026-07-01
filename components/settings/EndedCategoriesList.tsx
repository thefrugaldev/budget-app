import { EndedCategoryRow } from "@/components/settings/EndedCategoryRow";
import type { Category } from "@/types/budget";

/**
 * The ended-category list for Settings → Categories (#81 story 7). Renders one
 * reopenable row per category, or a calm note when nothing is hidden. The
 * caller (the Settings route) has already filtered to ended categories via
 * `isCategoryEnded`, so this component just presents them.
 */
export function EndedCategoriesList({
  categories,
}: {
  categories: Array<Category & { activeUntil: string }>;
}) {
  if (categories.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No ended categories — everything you have is active.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {categories.map((category) => (
        <EndedCategoryRow key={category.id} category={category} />
      ))}
    </ul>
  );
}
