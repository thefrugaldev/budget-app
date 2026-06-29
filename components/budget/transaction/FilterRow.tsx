"use client";

import { useId } from "react";

import { CategoryMultiSelect } from "@/components/budget/category/CategoryMultiSelect";
import { DateRangeField } from "@/components/ui/DateRangeField";
import { cn } from "@/lib/utils";
import type { Category } from "@/types/budget";
import type { TransactionFilter } from "@/types/transaction";

/**
 * Filter controls above the transaction list: free-text search, a vendor
 * select, and a date-range field. The global `/transactions` list additionally
 * gets a category multi-select (passed `categories`); the per-category detail
 * list omits it (story 18, 24, 64).
 */
export function FilterRow({
  filter,
  onChange,
  vendorOptions,
  categories,
}: {
  filter: TransactionFilter;
  onChange: (next: TransactionFilter) => void;
  vendorOptions: string[];
  /** Present only on the global list — enables the category multi-select. */
  categories?: Category[];
}) {
  // Every filter control gets a real, associated <label> (not a placeholder or
  // a bare aria-label) for assistive tech (story 9/17). The labels are sr-only
  // so the compact filter grid is unchanged; useId keeps each association unique
  // if two filter rows ever mount on one page.
  const searchId = useId();
  const vendorId = useId();
  const dateId = useId();
  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-2 rounded-2xl bg-card p-3 ring-1 ring-border",
        categories
          ? "sm:grid-cols-[minmax(160px,1fr)_1fr_160px_minmax(220px,1fr)]"
          : "sm:grid-cols-[1fr_160px_minmax(220px,1fr)]",
      )}
    >
      {categories && (
        <CategoryMultiSelect
          categories={categories}
          selected={filter.categoryIds ?? []}
          onChange={(ids) => onChange({ ...filter, categoryIds: ids })}
        />
      )}
      <div>
        <label htmlFor={searchId} className="sr-only">
          Search vendor or note
        </label>
        <input
          id={searchId}
          type="search"
          placeholder="Search vendor or note…"
          value={filter.text ?? ""}
          onChange={(e) => onChange({ ...filter, text: e.target.value })}
          className="w-full rounded-md bg-background px-3 py-1.5 text-sm ring-1 ring-border outline-none focus:ring-ring"
        />
      </div>
      <div>
        <label htmlFor={vendorId} className="sr-only">
          Vendor
        </label>
        <select
          id={vendorId}
          value={filter.vendor ?? ""}
          onChange={(e) => onChange({ ...filter, vendor: e.target.value })}
          className="w-full rounded-md bg-background px-2 py-1.5 text-sm ring-1 ring-border outline-none focus:ring-ring"
        >
          <option value="">All vendors</option>
          {vendorOptions.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor={dateId} className="sr-only">
          Date range
        </label>
        <DateRangeField
          id={dateId}
          from={filter.dateFrom ?? ""}
          to={filter.dateTo ?? ""}
          onChange={({ from, to }) =>
            onChange({ ...filter, dateFrom: from, dateTo: to })
          }
          placeholder="Any date"
        />
      </div>
    </div>
  );
}
