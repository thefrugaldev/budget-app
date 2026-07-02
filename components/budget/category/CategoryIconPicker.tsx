"use client";

import { Popover } from "@base-ui/react/popover";
import { createElement, useMemo, useState } from "react";

import { CATEGORY_ICONS, resolveCategoryIcon } from "@/lib/category/icon";
import { cn } from "@/lib/utils";

/**
 * Category icon picker (#80 chunk 4) — the identity-set replacement for the
 * free-form `EmojiPickerButton`. Presents the curated lucide set and, to avoid
 * a schema change, stores the chosen icon's representative *emoji* in the same
 * hidden input the old picker used (`inputName`, default `emoji`). Rendering
 * everywhere goes back through `resolveCategoryIcon`, so the round-trip is
 * exact. Its prop shape mirrors `EmojiPickerButton` so it drops into the
 * existing category create/edit forms.
 */

// name-fragment → icon key, so typing a category name surfaces likely icons
// first (mirrors the old emoji name-hints). Substring, lower-cased. The icon
// labels are also matched, so only non-obvious synonyms need listing here.
const NAME_SYNONYMS: ReadonlyArray<readonly [string, string]> = [
  ["grocer", "groceries"],
  ["restaurant", "dining"],
  ["food", "dining"],
  ["lunch", "dining"],
  ["fuel", "gas"],
  ["uber", "transit"],
  ["lyft", "transit"],
  ["train", "transit"],
  ["bus", "transit"],
  ["flight", "travel"],
  ["hotel", "travel"],
  ["rent", "home"],
  ["mortgage", "home"],
  ["house", "home"],
  ["electric", "utilities"],
  ["water", "utilities"],
  ["power", "utilities"],
  ["wifi", "internet"],
  ["streaming", "subscription"],
  ["movie", "entertainment"],
  ["gym", "fitness"],
  ["workout", "fitness"],
  ["doctor", "health"],
  ["medical", "health"],
  ["dentist", "health"],
  ["school", "education"],
  ["book", "education"],
  ["tuition", "education"],
  ["dog", "pets"],
  ["cat", "pets"],
  ["vet", "pets"],
  ["beer", "drinks"],
  ["bar", "drinks"],
  ["wine", "drinks"],
  ["salary", "work"],
  ["paycheck", "income"],
  ["bonus", "income"],
  ["gig", "work"],
  ["rsu", "investment"],
  ["dividend", "investment"],
  ["brokerage", "investment"],
  ["hysa", "bank"],
  ["deposit", "bank"],
  ["emergency", "emergency"],
  ["retirement", "vacation"],
];

function suggestedKeys(nameHint: string | undefined): readonly string[] {
  const q = nameHint?.toLowerCase().trim();
  if (!q) return [];
  const keys = new Set<string>();
  for (const entry of CATEGORY_ICONS) {
    if (q.includes(entry.key) || q.includes(entry.label.toLowerCase())) {
      keys.add(entry.key);
    }
  }
  for (const [fragment, key] of NAME_SYNONYMS) {
    if (q.includes(fragment)) keys.add(key);
  }
  return [...keys].slice(0, 6);
}

export type CategoryIconPickerProps = {
  /** Controlled value — the representative emoji. Pair with `onChange`. */
  value?: string;
  onChange?: (nextEmoji: string) => void;
  /** Uncontrolled initial value. Ignored when `value` is provided. */
  defaultValue?: string;
  /** Name for the hidden form input that carries the emoji. Default `emoji`. */
  inputName?: string;
  /** Free-text name the user is typing; surfaces suggested icons first. */
  nameHint?: string;
  /** Accessible label for the trigger button. */
  ariaLabel?: string;
  /** Extra classes for the trigger button. */
  className?: string;
};

export function CategoryIconPicker({
  value,
  onChange,
  defaultValue,
  inputName = "emoji",
  nameHint,
  ariaLabel = "Choose category icon",
  className,
}: CategoryIconPickerProps) {
  const [internal, setInternal] = useState(defaultValue ?? "");
  const isControlled = value !== undefined;
  const current = isControlled ? value : internal;

  function set(nextEmoji: string) {
    if (!isControlled) setInternal(nextEmoji);
    onChange?.(nextEmoji);
  }

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const suggestions = useMemo(() => suggestedKeys(nameHint), [nameHint]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return CATEGORY_ICONS;
    return CATEGORY_ICONS.filter(
      (e) => e.label.toLowerCase().includes(q) || e.key.includes(q),
    );
  }, [query]);

  const suggestedEntries = CATEGORY_ICONS.filter((e) =>
    suggestions.includes(e.key),
  );

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <input type="hidden" name={inputName} value={current} />
      <Popover.Trigger
        aria-label={ariaLabel}
        className={cn(
          "flex h-full w-full cursor-pointer items-center justify-center rounded-md bg-background py-2 text-foreground ring-1 ring-border outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring",
          className,
        )}
      >
        {createElement(resolveCategoryIcon({ emoji: current }), {
          "aria-hidden": true,
          className: "size-5",
        })}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner sideOffset={6} align="start" className="z-50">
          <Popover.Popup
            aria-label="Category icons"
            className="w-[280px] rounded-xl bg-card p-3 shadow-xl ring-1 ring-border outline-none transition-opacity data-[ending-style]:opacity-0 data-[starting-style]:opacity-0"
          >
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search icons…"
              aria-label="Search icons"
              className="mb-2 w-full rounded-md bg-background px-2 py-1.5 text-sm ring-1 ring-border outline-none focus:ring-ring"
            />

            {query === "" && suggestedEntries.length > 0 && (
              <div className="mb-2 space-y-1">
                <span className="block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Suggested
                </span>
                <div className="flex flex-wrap gap-1">
                  {suggestedEntries.map((e) => (
                    <IconButton
                      key={e.key}
                      entry={e}
                      selected={current === e.emoji}
                      onSelect={() => {
                        set(e.emoji);
                        setOpen(false);
                      }}
                    />
                  ))}
                </div>
              </div>
            )}

            {filtered.length === 0 ? (
              <p className="px-1 py-6 text-center text-xs text-muted-foreground">
                No icons match “{query}”.
              </p>
            ) : (
              <div className="grid max-h-[220px] grid-cols-6 gap-1 overflow-y-auto">
                {filtered.map((e) => (
                  <IconButton
                    key={e.key}
                    entry={e}
                    selected={current === e.emoji}
                    onSelect={() => {
                      set(e.emoji);
                      setOpen(false);
                    }}
                  />
                ))}
              </div>
            )}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}

function IconButton({
  entry,
  selected,
  onSelect,
}: {
  entry: (typeof CATEGORY_ICONS)[number];
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
