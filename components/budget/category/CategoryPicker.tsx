"use client";

import { Check, ChevronDown, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { CategoryIcon } from "@/components/budget/category/CategoryIcon";
import { cn } from "@/lib/utils";
import type { Category, CategoryKind } from "@/types/budget";

const KIND_LABELS = {
  expense: "Expenses",
  savings: "Savings",
  income: "Income",
} as const satisfies Record<CategoryKind, string>;
// Derived from KIND_LABELS so adding a CategoryKind without updating the
// labels object is a compile error, and the picker can never silently drop
// a kind. Object.keys is typed as `string[]`, so cast back to the union.
const KIND_ORDER = Object.keys(KIND_LABELS) as readonly CategoryKind[];

/**
 * Searchable, kind-grouped category selector. Extracted from TransactionForm
 * (issue #17 chunk 4) so the bulk-recategorise action can reuse the exact same
 * picker the Add/Edit form uses — categories grouped Expenses / Savings /
 * Income, filtered by name or emoji, single-select.
 *
 * `label` overrides the "Category" heading (the bulk bar passes "Move to…");
 * pass `hideLabel` to drop the heading entirely. `autoFocusSearch` opens with
 * the search box focused — handy when the picker mounts inside a popover.
 */
export function CategoryPicker({
  categories,
  selectedId,
  onChange,
  label = "Category",
  hideLabel = false,
  autoFocusSearch = false,
  triggerAriaLabel,
  overlayPanel = false,
}: {
  categories: Category[];
  selectedId: string | undefined;
  onChange: (id: string) => void;
  label?: string;
  hideLabel?: boolean;
  autoFocusSearch?: boolean;
  /**
   * Accessible name for the trigger button when the visible `label` is hidden
   * or doesn't convey the action (e.g. the header-band CategorySwitcher, whose
   * trigger reads the current category but needs to announce "Switch category").
   */
  triggerAriaLabel?: string;
  /**
   * Float the panel as an absolute overlay instead of expanding inline. Off by
   * default so form usages keep pushing content down (their column has room);
   * the header-band CategorySwitcher opts in so opening the dropdown doesn't
   * reflow the page. Overlay mode also dismisses on outside-click / Escape.
   */
  overlayPanel?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = selectedId ? categories.find((c) => c.id === selectedId) : undefined;

  // A floating panel covers content, so it needs the dismissal affordances an
  // inline panel doesn't: click-away and Escape. Scoped to overlay mode so form
  // usages are untouched.
  useEffect(() => {
    if (!overlayPanel || !open) return;
    function onPointerDown(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [overlayPanel, open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return KIND_ORDER.map((kind) => ({
      kind,
      label: KIND_LABELS[kind],
      items: categories.filter(
        (c) => c.kind === kind && (q === "" || c.name.toLowerCase().includes(q)),
      ),
    })).filter((g) => g.items.length > 0);
  }, [categories, query]);

  return (
    <div ref={rootRef} className={cn("space-y-1", overlayPanel && "relative")}>
      {!hideLabel && (
        <span className="block text-xs font-medium text-muted-foreground">{label}</span>
      )}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={triggerAriaLabel}
        className="flex w-full items-center justify-between rounded-md bg-background px-2 py-1.5 text-left text-sm ring-1 ring-border outline-none focus:ring-ring"
      >
        {selected ? (
          <span className="flex items-center gap-2">
            <CategoryIcon
              category={selected}
              className="size-4 rounded-none bg-transparent text-current"
              iconClassName="size-4"
            />
            <span>{selected.name}</span>
            <span className="text-xs text-muted-foreground">· {KIND_LABELS[selected.kind]}</span>
          </span>
        ) : (
          <span className="text-muted-foreground">Pick a category…</span>
        )}
        <ChevronDown className="size-4 text-muted-foreground" aria-hidden />
      </button>

      {open && (
        <div
          className={cn(
            "rounded-md p-2 ring-1 ring-border",
            overlayPanel
              ? "absolute left-0 right-0 top-full z-20 mt-1 bg-popover shadow-md"
              : "bg-card",
          )}
        >
          <div className="mb-2 flex items-center gap-2 rounded-md bg-background px-2 py-1 ring-1 ring-border">
            <Search className="size-3.5 text-muted-foreground" aria-hidden />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search categories"
              autoFocus={autoFocusSearch}
              className="w-full bg-transparent text-sm outline-none"
            />
          </div>
          <div className="max-h-60 space-y-2 overflow-auto">
            {filtered.length === 0 && (
              <p className="px-2 py-3 text-center text-xs text-muted-foreground">
                No categories match.
              </p>
            )}
            {filtered.map((group) => (
              <div key={group.kind}>
                <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {group.label}
                </p>
                <ul>
                  {group.items.map((c) => (
                    <li key={c.id}>
                      <button
                        type="button"
                        onClick={() => {
                          onChange(c.id);
                          setOpen(false);
                          setQuery("");
                        }}
                        className={cn(
                          "flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted",
                          selectedId === c.id && "bg-muted",
                        )}
                      >
                        <span className="flex items-center gap-2">
                          <CategoryIcon
                            category={c}
                            className="size-4 rounded-none bg-transparent text-current"
                            iconClassName="size-4"
                          />
                          <span>{c.name}</span>
                        </span>
                        {selectedId === c.id && <Check className="size-4" aria-hidden />}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
