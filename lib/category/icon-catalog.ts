import { icons, type LucideIcon } from "lucide-react";

/**
 * The full lucide catalogue (~1.7k icons) — heavy, so this module is imported
 * ONLY from lazily-loaded chunks (the picker grid and the long-tail icon
 * renderer). Keeping it out of `lib/category/icon.ts` is deliberate: that
 * module is on the broad render path, so pulling the whole set in there would
 * bundle ~170KB gz into every route. See `icon.ts` for the light render path.
 */
const ICONS = icons as unknown as Record<string, LucideIcon>;

/** Look up any lucide component by its PascalCase name. */
export function catalogIconByName(name: string | undefined): LucideIcon | undefined {
  if (!name) return undefined;
  return ICONS[name];
}

/** A searchable entry for every lucide icon — powers the picker. */
export type IconChoice = {
  /** PascalCase name, stored in `Category.icon`. */
  name: string;
  /** Space-separated, lower-cased label for display + substring search. */
  label: string;
  Icon: LucideIcon;
};

// "ShoppingCart" → "shopping cart", "AArrowDown" → "a arrow down".
function humanize(name: string): string {
  return name
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .toLowerCase();
}

/** Every lucide icon, in the library's order — the picker's full catalogue. */
export const ALL_ICONS: readonly IconChoice[] = Object.keys(ICONS).map(
  (name) => ({ name, label: humanize(name), Icon: ICONS[name] }),
);

/** Filter the catalogue by a free-text query (matches name or label). */
export function searchIcons(query: string): readonly IconChoice[] {
  const q = query.trim().toLowerCase();
  if (!q) return ALL_ICONS;
  return ALL_ICONS.filter(
    (i) => i.label.includes(q) || i.name.toLowerCase().includes(q),
  );
}
