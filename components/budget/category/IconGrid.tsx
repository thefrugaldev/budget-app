"use client";

import { useMemo, useState } from "react";

import { ALL_ICONS, searchIcons } from "@/lib/category/iconCatalog";
import { cn } from "@/lib/utils";

/**
 * The searchable icon grid inside the picker popover. Imports the full lucide
 * catalogue, so it's loaded lazily by `CategoryIconPicker` (only when the
 * popover opens) to keep the catalogue out of route bundles.
 *
 * Rendering is capped + searchable rather than virtualized: a bounded grid
 * keeps every visible button in the natural tab order (the project's windowing
 * rule wants focus reachability), and search reaches any icon in the library.
 */
const RESULT_CAP = 300;

export default function IconGrid({
  current,
  onSelect,
  nameHint,
}: {
  current: string;
  onSelect: (name: string) => void;
  nameHint?: string;
}) {
  const [query, setQuery] = useState("");

  const results = useMemo(() => {
    const q = query.trim();
    if (q) return searchIcons(q).slice(0, RESULT_CAP);
    return ALL_ICONS.slice(0, RESULT_CAP);
  }, [query]);

  const suggestions = useMemo(() => {
    if (query.trim() || !nameHint?.trim()) return [];
    return searchIcons(nameHint).slice(0, 6);
  }, [query, nameHint]);

  const total = ALL_ICONS.length;
  const truncated = !query.trim() && total > RESULT_CAP;

  return (
    <div>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search icons…"
        aria-label="Search icons"
        autoFocus
        className="mb-2 w-full rounded-md bg-background px-2 py-1.5 text-sm ring-1 ring-border outline-none focus:ring-ring"
      />

      {suggestions.length > 0 && (
        <div className="mb-2 space-y-1">
          <span className="block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Suggested
          </span>
          <div className="flex flex-wrap gap-1">
            {suggestions.map((entry) => (
              <IconButton
                key={entry.name}
                entry={entry}
                selected={current === entry.name}
                onSelect={() => onSelect(entry.name)}
              />
            ))}
          </div>
        </div>
      )}

      {results.length === 0 ? (
        <p className="px-1 py-6 text-center text-xs text-muted-foreground">
          No icons match “{query}”.
        </p>
      ) : (
        <div className="grid max-h-[240px] grid-cols-6 gap-1 overflow-y-auto">
          {results.map((entry) => (
            <IconButton
              key={entry.name}
              entry={entry}
              selected={current === entry.name}
              onSelect={() => onSelect(entry.name)}
            />
          ))}
        </div>
      )}

      {truncated && (
        <p className="mt-2 px-1 text-[11px] text-muted-foreground">
          Showing {RESULT_CAP} of {total.toLocaleString()} — search to find any icon.
        </p>
      )}
    </div>
  );
}

function IconButton({
  entry,
  selected,
  onSelect,
}: {
  entry: (typeof ALL_ICONS)[number];
  selected: boolean;
  onSelect: () => void;
}) {
  const Icon = entry.Icon;
  return (
    <button
      type="button"
      onClick={onSelect}
      title={entry.label}
      aria-label={entry.label}
      aria-pressed={selected}
      className={cn(
        "grid aspect-square cursor-pointer place-items-center rounded-md ring-1 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
        selected
          ? "bg-primary text-primary-foreground ring-primary"
          : "bg-background text-foreground ring-border hover:bg-muted",
      )}
    >
      <Icon aria-hidden className="size-5" />
    </button>
  );
}
