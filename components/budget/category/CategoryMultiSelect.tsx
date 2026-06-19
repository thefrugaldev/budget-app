"use client";

import { Popover } from "@base-ui/react/popover";
import { ChevronDown } from "lucide-react";
import { useMemo } from "react";

import { Checkbox } from "@/components/ui/Checkbox";
import { cn } from "@/lib/utils";
import type { Category, CategoryKind } from "@/types/budget";

const KIND_LABELS = {
  expense: "Expenses",
  savings: "Savings",
  income: "Income",
} as const satisfies Record<CategoryKind, string>;
const KIND_ORDER = Object.keys(KIND_LABELS) as readonly CategoryKind[];

/**
 * Kind-grouped category multi-select for the global `/transactions` filter row
 * (issue #17 chunk 5, story 18). The category-detail list is single-category,
 * so this control only appears in global mode. Trigger mirrors the FilterRow's
 * native `<select>` styling and summarises the selection ("All categories" /
 * one name / "N categories"); the popover lists every category as a checkbox,
 * with a Clear shortcut. Selection is controlled — `selected` is the set of
 * chosen category ids, empty meaning "all".
 */
export function CategoryMultiSelect({
  categories,
  selected,
  onChange,
}: {
  categories: Category[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const groups = useMemo(
    () =>
      KIND_ORDER.map((kind) => ({
        kind,
        label: KIND_LABELS[kind],
        items: categories.filter((c) => c.kind === kind),
      })).filter((g) => g.items.length > 0),
    [categories],
  );

  const selectedSet = useMemo(() => new Set(selected), [selected]);

  function toggle(id: string, on: boolean) {
    if (on) onChange([...new Set([...selected, id])]);
    else onChange(selected.filter((s) => s !== id));
  }

  const summary =
    selected.length === 0
      ? "All categories"
      : selected.length === 1
        ? (categories.find((c) => c.id === selected[0])?.name ?? "1 category")
        : `${selected.length} categories`;

  return (
    <Popover.Root>
      <Popover.Trigger
        aria-label="Filter by category"
        className="flex items-center justify-between gap-1 rounded-md bg-background px-2 py-1.5 text-sm ring-1 ring-border outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className={cn("truncate", selected.length === 0 && "text-muted-foreground")}>
          {summary}
        </span>
        <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner sideOffset={6} align="start" className="z-50">
          <Popover.Popup
            aria-label="Categories"
            className="max-h-[min(24rem,60vh)] w-64 overflow-y-auto rounded-xl bg-card p-1.5 shadow-xl ring-1 ring-border outline-none data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 transition-opacity"
          >
            <div className="flex items-center justify-between px-2 py-1">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Categories
              </span>
              {selected.length > 0 && (
                <button
                  type="button"
                  onClick={() => onChange([])}
                  className="cursor-pointer rounded px-1.5 py-0.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  Clear
                </button>
              )}
            </div>
            {groups.map((group) => (
              <div key={group.kind} className="mt-1">
                <span className="block px-2 pb-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/70">
                  {group.label}
                </span>
                {group.items.map((c) => (
                  <label
                    key={c.id}
                    className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
                  >
                    <Checkbox
                      label={c.name}
                      checked={selectedSet.has(c.id)}
                      onCheckedChange={(on) => toggle(c.id, on)}
                    />
                    <span aria-hidden>{c.emoji}</span>
                    <span className="truncate">{c.name}</span>
                  </label>
                ))}
              </div>
            ))}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
