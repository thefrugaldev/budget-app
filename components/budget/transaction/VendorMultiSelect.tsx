"use client";

import { Popover } from "@base-ui/react/popover";
import { ChevronDown } from "lucide-react";
import { useId, useMemo, useState } from "react";

import { Checkbox } from "@/components/ui/Checkbox";
import { cn } from "@/lib/utils";

/**
 * The empty-string member of a vendor selection — the explicit "No vendor"
 * pseudo-option. Kept as a named export so the predicate/URL seam and this
 * control agree on the sentinel.
 */
export const NO_VENDOR = "";

/**
 * Vendor multi-select for the transaction filter row (issue #165 chunk 4).
 * Upgrades the old single `<select>` to an OR-combined multi-select, and adds a
 * pinned **No vendor** option so the vendorless imported rows ("Monthly total"
 * / "—") are selectable without typing their magic note string. The trigger
 * mirrors the FilterRow's native controls and summarises the selection; the
 * popover lists every vendor as a checkbox behind a search box (the real vendor
 * set spans years of history, so the list is long — the search narrows the
 * rendered rows). Selection is controlled — `selected` is the chosen vendor
 * strings, with `""` meaning No vendor; empty means "all vendors".
 */
export function VendorMultiSelect({
  vendorOptions,
  selected,
  onChange,
}: {
  /** Available vendor strings, trimmed non-empty (the No-vendor option is added here). */
  vendorOptions: string[];
  selected: string[];
  onChange: (vendors: string[]) => void;
}) {
  const searchId = useId();
  const [query, setQuery] = useState("");
  const selectedSet = useMemo(() => new Set(selected), [selected]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return vendorOptions;
    return vendorOptions.filter((v) => v.toLowerCase().includes(q));
  }, [vendorOptions, query]);

  function toggle(value: string, on: boolean) {
    if (on) onChange([...new Set([...selected, value])]);
    else onChange(selected.filter((v) => v !== value));
  }

  const noVendorSelected = selectedSet.has(NO_VENDOR);
  const summary =
    selected.length === 0
      ? "All vendors"
      : selected.length === 1
        ? noVendorSelected
          ? "No vendor"
          : selected[0]
        : `${selected.length} vendors`;

  return (
    <Popover.Root>
      <Popover.Trigger
        aria-label="Filter by vendor"
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
            aria-label="Vendors"
            className="flex max-h-[min(24rem,60vh)] w-64 flex-col rounded-xl bg-card p-1.5 shadow-xl ring-1 ring-border outline-none data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 transition-opacity"
          >
            <div className="flex items-center justify-between px-2 py-1">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Vendors
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
            <label htmlFor={searchId} className="sr-only">
              Search vendors
            </label>
            <input
              id={searchId}
              type="search"
              placeholder="Search vendors…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="mx-1 mb-1 rounded-md bg-background px-2 py-1.5 text-sm ring-1 ring-border outline-none focus:ring-ring"
            />
            <div className="min-h-0 flex-1 overflow-y-auto">
              {/* No vendor is pinned above the searchable list — it's not a real
                  vendor string, so search never hides it. */}
              <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted">
                <Checkbox
                  checked={noVendorSelected}
                  onCheckedChange={(on) => toggle(NO_VENDOR, on)}
                />
                <span className="truncate text-muted-foreground italic">No vendor</span>
              </label>
              {shown.map((v) => (
                <label
                  key={v}
                  className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
                >
                  <Checkbox checked={selectedSet.has(v)} onCheckedChange={(on) => toggle(v, on)} />
                  <span className="truncate">{v}</span>
                </label>
              ))}
              {shown.length === 0 && (
                <p className="px-2 py-1.5 text-xs text-muted-foreground">No matching vendors.</p>
              )}
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
