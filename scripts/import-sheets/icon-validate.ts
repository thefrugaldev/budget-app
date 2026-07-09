import { catalogIconByName } from "@/lib/category/iconCatalog";

import type { CategoryMapping, IncomeConfig } from "./types";

/**
 * Icon-catalog validation (story 7 / design baseline: "a new category id must
 * resolve to an icon — no blanks"). Every `icon` in the mapping and income
 * config must be a real lucide component name, checked against the app's own
 * catalog so an imported category can never render a blank tile. Runs at
 * extract time — before any manifest is written — so a typo'd icon fails the
 * run rather than surfacing in the app.
 *
 * Returns the list of offending `"<where>: <icon>"` strings (empty when all
 * resolve), letting the caller decide how to surface them.
 */
export function findUnknownIcons(
  mapping: CategoryMapping,
  income: IncomeConfig,
): string[] {
  const bad: string[] = [];
  for (const c of mapping.categories) {
    if (!catalogIconByName(c.icon)) bad.push(`category "${c.canonicalName}": ${c.icon}`);
  }
  for (const s of income.sources) {
    if (!catalogIconByName(s.icon)) bad.push(`income "${s.canonicalName}": ${s.icon}`);
  }
  return bad;
}

/** Throw a single aggregated error when any icon is unknown. */
export function assertIconsResolve(
  mapping: CategoryMapping,
  income: IncomeConfig,
): void {
  const bad = findUnknownIcons(mapping, income);
  if (bad.length > 0) {
    throw new Error(
      `Unknown lucide icon(s) — not in the app catalog:\n  ${bad.join("\n  ")}`,
    );
  }
}
