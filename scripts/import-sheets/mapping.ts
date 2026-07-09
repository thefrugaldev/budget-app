import type {
  CategoryMapping,
  MappedCategory,
  VendorRewrite,
} from "./types";

/**
 * Category mapping application (ADR 0005 decision 5): spreadsheet row labels
 * are resolved to canonical app categories through a *curated table*, not name
 * matching. Rename chains (a category relabelled over the years) collapse to
 * one canonical category by listing every label as an `alias`; a genuine split
 * (a since-ended predecessor that is a different category) is expressed as two
 * mapping entries with disjoint aliases. Matching is case-insensitive after
 * trimming so trailing spaces and capitalization drift in the sheets don't
 * cause a miss.
 *
 * Returns the matched {@link MappedCategory}, or `null` for an unmapped label —
 * extract treats an unmapped nonzero row as a hard error (every row must have a
 * home) rather than silently dropping data.
 */
export function resolveCategory(
  rowLabel: string,
  mapping: CategoryMapping,
): MappedCategory | null {
  const needle = normalize(rowLabel);
  if (needle === "") return null;

  for (const category of mapping.categories) {
    if (category.aliases.some((alias) => normalize(alias) === needle)) {
      return category;
    }
  }
  return null;
}

/**
 * Apply the curated vendor-rewrite rules to a raw vendor string, in order, so
 * one codified rule replaces thousands of hand-edits (story 11). `exact` rules
 * replace the whole vendor case-insensitively and stop at the first match;
 * `regex` rules apply a case-insensitive `String.replace` and fall through so
 * several normalizations can compose. A `null` vendor (a line with no vendor)
 * passes straight through.
 */
export function rewriteVendor(
  vendor: string | null,
  rewrites: VendorRewrite[],
): string | null {
  if (vendor === null) return null;

  let out = vendor;
  for (const rule of rewrites) {
    if ((rule.mode ?? "exact") === "exact") {
      if (normalize(out) === normalize(rule.match)) return rule.to;
    } else {
      out = out.replace(new RegExp(rule.match, "gi"), rule.to);
    }
  }
  return out;
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}
