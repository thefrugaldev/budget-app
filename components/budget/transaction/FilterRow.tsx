"use client";

import { useId } from "react";

import { CategoryMultiSelect } from "@/components/budget/category/CategoryMultiSelect";
import { DateRangeField } from "@/components/ui/DateRangeField";
import { cn } from "@/lib/utils";
import type { Category, CategoryKind } from "@/types/budget";
import type { TransactionFilter } from "@/types/transaction";

/**
 * The Expense / Savings / Income toggles, in canonical order. Toggling always
 * rebuilds `kinds` from this order (not click order) so the URL is stable.
 */
const KIND_OPTIONS: readonly { kind: CategoryKind; label: string }[] = [
  { kind: "expense", label: "Expense" },
  { kind: "savings", label: "Savings" },
  { kind: "income", label: "Income" },
];

/** All / Imported / Manual — single-select; `undefined` is the All state. */
const PROVENANCE_OPTIONS: readonly {
  value: TransactionFilter["provenance"];
  label: string;
}[] = [
  { value: undefined, label: "All" },
  { value: "imported", label: "Imported" },
  { value: "manual", label: "Manual" },
];

/** Shared segmented-group shell (`bg-muted` track + hairline ring). */
const SEGMENTED_GROUP =
  "inline-flex rounded-md bg-muted p-0.5 text-xs ring-1 ring-border";
/** Shared segment button; `active` swaps to the raised, filled state. */
const segment = (active: boolean) =>
  cn(
    "cursor-pointer rounded-[5px] px-2.5 py-1 font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
    active
      ? "bg-background text-foreground shadow-sm"
      : "text-muted-foreground hover:text-foreground",
  );

/**
 * Filter controls above the transaction list: free-text search, a vendor
 * select, and a date-range field. The global `/transactions` list additionally
 * gets a category multi-select and an Expense / Savings / Income kind toggle
 * (both passed `categories`); the per-category detail list omits them — it is
 * single-kind (story 18, 24, 64).
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
  // Kind toggle is global-list-only. Rebuild from KIND_OPTIONS order so the
  // stored (and serialized) array is deterministic regardless of click order.
  const selectedKinds = filter.kinds ?? [];
  const toggleKind = (kind: CategoryKind) => {
    const set = new Set(selectedKinds);
    if (set.has(kind)) set.delete(kind);
    else set.add(kind);
    onChange({
      ...filter,
      kinds: KIND_OPTIONS.map((o) => o.kind).filter((k) => set.has(k)),
    });
  };
  return (
    <div className="space-y-2 rounded-2xl bg-card p-3 ring-1 ring-border">
      {categories && (
        <div className="flex flex-wrap gap-2">
          <div role="group" aria-label="Filter by kind" className={SEGMENTED_GROUP}>
            {KIND_OPTIONS.map(({ kind, label }) => {
              const active = selectedKinds.includes(kind);
              return (
                <button
                  key={kind}
                  type="button"
                  onClick={() => toggleKind(kind)}
                  aria-pressed={active}
                  className={segment(active)}
                >
                  {label}
                </button>
              );
            })}
          </div>
          {/* Provenance is single-select (All / Imported / Manual): exactly one
              is active, and All (undefined) is the no-constraint default. */}
          <div role="group" aria-label="Filter by source" className={SEGMENTED_GROUP}>
            {PROVENANCE_OPTIONS.map(({ value, label }) => {
              const active = (filter.provenance ?? undefined) === value;
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => onChange({ ...filter, provenance: value })}
                  aria-pressed={active}
                  className={segment(active)}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      )}
      <div
        className={cn(
          "grid grid-cols-1 gap-2",
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
    </div>
  );
}
