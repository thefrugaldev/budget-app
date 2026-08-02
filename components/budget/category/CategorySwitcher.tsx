"use client";

import { useRouter } from "next/navigation";

import { CategoryPicker } from "@/components/budget/category/CategoryPicker";
import type { Category } from "@/types/budget";
import type { RangePreset } from "@/types/range";

/**
 * Header-band control on a category's detail page: jump straight to another
 * category without routing back through /categories first. Reuses the same
 * searchable, kind-grouped CategoryPicker the Add/Edit form uses.
 *
 * Income categories are excluded — they live on /income and mis-fit this
 * shared detail page. The current `?range=` window is preserved across the
 * jump (mirroring RangeSelector's href rule) so the selected time range
 * carries over. This is a read-only, navigational affordance — not role-gated;
 * viewers switch categories too.
 */
export function CategorySwitcher({
  categories,
  currentId,
  rangePreset,
}: {
  categories: Category[];
  currentId: string;
  rangePreset: RangePreset;
}) {
  const router = useRouter();
  const switchable = categories.filter((c) => c.kind !== "income");

  return (
    <div className="w-full max-w-xs">
      <CategoryPicker
        categories={switchable}
        selectedId={currentId}
        hideLabel
        triggerAriaLabel="Switch category"
        onChange={(id) => {
          if (id === currentId) return;
          const href =
            rangePreset === "this-month"
              ? `/categories/${id}`
              : `/categories/${id}?range=${rangePreset}`;
          router.push(href);
        }}
      />
    </div>
  );
}
