"use client";

import { useMemo, useRef, useState } from "react";

import { ALL_ICONS, searchIcons } from "@/lib/category/icon-catalog";
import { cn } from "@/lib/utils";

/**
 * The searchable icon grid inside the picker popover. Imports the full lucide
 * catalogue, so it's loaded lazily by `CategoryIconPicker` (only when the
 * popover opens) to keep the catalogue out of route bundles.
 *
 * Rendering is capped + searchable rather than virtualized: a bounded grid
 * keeps every button in the DOM, so a roving-tabindex + arrow-key model gives
 * real keyboard traversal (Tab in/out is one stop; arrows move within), and
 * search reaches any icon in the library.
 */
const RESULT_CAP = 300;
const COLS = 6;

const clamp = (n: number, min: number, max: number) =>
  Math.max(min, Math.min(max, n));

// Budget vocabulary → lucide icon names, so the name field suggests useful
// icons for words that aren't lucide-native (e.g. "salary", "rent"). Substring
// match on the typed name; merged with lucide's own name matches below.
const NAME_HINTS: ReadonlyArray<readonly [string, readonly string[]]> = [
  ["grocer", ["ShoppingCart", "Carrot"]],
  ["dining", ["Utensils"]],
  ["restaurant", ["Utensils"]],
  ["food", ["Utensils"]],
  ["rent", ["House", "KeyRound"]],
  ["mortgage", ["House"]],
  ["util", ["Lightbulb", "Zap"]],
  ["electric", ["Zap"]],
  ["water", ["Droplet"]],
  ["internet", ["Wifi"]],
  ["phone", ["Smartphone"]],
  ["gas", ["Fuel"]],
  ["fuel", ["Fuel"]],
  ["transit", ["TrainFront", "Bus"]],
  ["travel", ["Plane"]],
  ["flight", ["Plane"]],
  ["vacation", ["Umbrella", "Plane"]],
  ["hotel", ["BedDouble"]],
  ["clothing", ["Shirt"]],
  ["clothes", ["Shirt"]],
  ["health", ["Stethoscope", "HeartPulse"]],
  ["medical", ["Stethoscope"]],
  ["doctor", ["Stethoscope"]],
  ["pharmacy", ["Pill"]],
  ["gym", ["Dumbbell"]],
  ["fitness", ["Dumbbell"]],
  ["entertain", ["Clapperboard"]],
  ["movie", ["Clapperboard"]],
  ["stream", ["Tv"]],
  ["subscription", ["Tv"]],
  ["music", ["Music"]],
  ["gaming", ["Gamepad2"]],
  ["education", ["GraduationCap"]],
  ["school", ["GraduationCap"]],
  ["tuition", ["GraduationCap"]],
  ["gift", ["Gift"]],
  ["pet", ["PawPrint"]],
  ["salary", ["Banknote", "Briefcase"]],
  ["paycheck", ["Banknote"]],
  ["income", ["Banknote"]],
  ["gig", ["Briefcase"]],
  ["freelance", ["Briefcase"]],
  ["saving", ["PiggyBank"]],
  ["invest", ["TrendingUp", "ChartLine"]],
  ["brokerage", ["TrendingUp"]],
  ["dividend", ["TrendingUp"]],
  ["retirement", ["PiggyBank", "Landmark"]],
  ["crypto", ["Bitcoin"]],
  ["bitcoin", ["Bitcoin"]],
  ["bank", ["Landmark"]],
  ["tax", ["Receipt"]],
  ["insurance", ["ShieldCheck"]],
  ["charity", ["HandHeart"]],
  ["donation", ["HandHeart"]],
  ["emergency", ["Siren"]],
  ["baby", ["Baby"]],
  ["kids", ["Baby"]],
  ["salon", ["Scissors"]],
  ["beauty", ["Sparkles"]],
  ["furniture", ["Sofa"]],
];

function hintNamesFor(nameHint: string): string[] {
  const q = nameHint.toLowerCase();
  const out: string[] = [];
  for (const [term, names] of NAME_HINTS) {
    if (q.includes(term)) out.push(...names);
  }
  return out;
}

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
  const [active, setActive] = useState(0);
  const gridRef = useRef<HTMLDivElement>(null);

  const byName = useMemo(() => new Map(ALL_ICONS.map((e) => [e.name, e])), []);

  const rawResults = useMemo(() => {
    const q = query.trim();
    if (q) return searchIcons(q).slice(0, RESULT_CAP);
    return ALL_ICONS.slice(0, RESULT_CAP);
  }, [query]);

  const suggestions = useMemo(() => {
    if (query.trim() || !nameHint?.trim()) return [];
    // Budget-vocabulary hints first, then lucide's own name matches.
    const names = new Set<string>([
      ...hintNamesFor(nameHint),
      ...searchIcons(nameHint).map((e) => e.name),
    ]);
    return [...names]
      .map((n) => byName.get(n))
      .filter((e): e is (typeof ALL_ICONS)[number] => Boolean(e))
      .slice(0, 6);
  }, [query, nameHint, byName]);

  // Don't repeat the suggested icons in the main grid below.
  const suggestedNames = new Set(suggestions.map((s) => s.name));
  const results = suggestions.length
    ? rawResults.filter((e) => !suggestedNames.has(e.name))
    : rawResults;

  const total = ALL_ICONS.length;
  const truncated = !query.trim() && total > RESULT_CAP;

  function focusCell(index: number) {
    const next = clamp(index, 0, results.length - 1);
    setActive(next);
    gridRef.current
      ?.querySelector<HTMLButtonElement>(`[data-idx="${next}"]`)
      ?.focus();
  }

  // Roving 2D navigation across the wrapped grid; the browser scrolls the
  // focused cell into view for free.
  function onGridKeyDown(e: React.KeyboardEvent) {
    switch (e.key) {
      case "ArrowRight":
        e.preventDefault();
        focusCell(active + 1);
        break;
      case "ArrowLeft":
        e.preventDefault();
        focusCell(active - 1);
        break;
      case "ArrowDown":
        e.preventDefault();
        focusCell(active + COLS);
        break;
      case "ArrowUp":
        e.preventDefault();
        focusCell(active - COLS);
        break;
      case "Home":
        e.preventDefault();
        focusCell(0);
        break;
      case "End":
        e.preventDefault();
        focusCell(results.length - 1);
        break;
    }
  }

  return (
    <div>
      <input
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" && results.length > 0) {
            e.preventDefault();
            focusCell(0);
          }
        }}
        placeholder="Search icons…"
        aria-label="Search icons"
        autoFocus
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        className="mb-2 w-full rounded-md bg-background px-2 py-1.5 text-sm ring-1 ring-border outline-none focus:ring-ring"
      />

      {/* Announce result changes for screen readers as the query narrows. */}
      <div aria-live="polite" className="sr-only">
        {results.length === 0
          ? `No icons match ${query}`
          : `${results.length} icons`}
      </div>

      {suggestions.length > 0 && (
        <div className="mb-2 space-y-1">
          <span className="block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Suggested
          </span>
          <div className="flex flex-wrap gap-1.5 px-0.5">
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
        // -mx-1/px-1/py-1: give the buttons' focus/selection rings room inside
        // the scroll box so edge cells aren't clipped, while the icons still
        // line up with the search field above.
        <div
          ref={gridRef}
          onKeyDown={onGridKeyDown}
          className="-mx-1 grid max-h-[240px] grid-cols-6 gap-1.5 overflow-y-auto overscroll-contain px-1 py-1"
        >
          {results.map((entry, i) => (
            <IconButton
              key={entry.name}
              entry={entry}
              index={i}
              tabbable={i === active}
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
  index,
  tabbable = true,
  selected,
  onSelect,
}: {
  entry: (typeof ALL_ICONS)[number];
  index?: number;
  tabbable?: boolean;
  selected: boolean;
  onSelect: () => void;
}) {
  const Icon = entry.Icon;
  return (
    <button
      type="button"
      data-idx={index}
      tabIndex={tabbable ? 0 : -1}
      onClick={onSelect}
      title={entry.label}
      aria-label={entry.label}
      aria-pressed={selected}
      className={cn(
        "grid aspect-square cursor-pointer touch-manipulation place-items-center rounded-md ring-1 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
        selected
          ? "bg-primary text-primary-foreground ring-primary"
          : "bg-background text-foreground ring-border hover:bg-muted",
      )}
    >
      <Icon aria-hidden className="size-5" />
    </button>
  );
}
