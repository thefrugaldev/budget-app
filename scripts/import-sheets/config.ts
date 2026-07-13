import type {
  CategoryMapping,
  IncomeConfig,
  IncomeSourceConfig,
  MappedCategory,
  MappedLiability,
  OverridesConfig,
} from "./types";

/**
 * Parse and validate the three curated config files from the private archive
 * repo — `mapping.json`, `overrides.json`, `income.json`. Extract reads the raw
 * JSON off disk; these functions turn `unknown` into a typed, well-formed
 * config or throw with a precise message, so a hand-edited config fails loudly
 * at the start of a run rather than producing a subtly wrong manifest.
 *
 * Validation here is structural only. Semantic checks that need the app (icon
 * names resolving to the catalog) live in {@link ./icon-validate}; checks that
 * need the workbooks (every nonzero row mapped) happen in the manifest builder.
 */

export function parseMapping(raw: unknown): CategoryMapping {
  const obj = asObject(raw, "mapping");
  const categories = asArray(obj.categories, "mapping.categories").map(
    (c, i) => parseMappedCategory(c, i),
  );
  const vendorRewrites = asArray(
    obj.vendorRewrites ?? [],
    "mapping.vendorRewrites",
  ).map((r, i) => {
    const rule = asObject(r, `mapping.vendorRewrites[${i}]`);
    return {
      match: asString(rule.match, `mapping.vendorRewrites[${i}].match`),
      to: asString(rule.to, `mapping.vendorRewrites[${i}].to`),
      mode: rule.mode === "regex" ? ("regex" as const) : ("exact" as const),
    };
  });

  const liabilities = asArray(
    obj.liabilities ?? [],
    "mapping.liabilities",
  ).map((l, i) => parseMappedLiability(l, i));

  const skipRows = asArray(obj.skipRows ?? [], "mapping.skipRows").map((s, i) =>
    asString(s, `mapping.skipRows[${i}]`),
  );

  assertUniqueAliases(categories);
  assertUniqueLiabilityAliases(liabilities);
  assertSkipRowsDisjoint(skipRows, categories);
  return { categories, vendorRewrites, liabilities, skipRows };
}

function parseMappedLiability(raw: unknown, i: number): MappedLiability {
  const l = asObject(raw, `mapping.liabilities[${i}]`);
  const aliases = asArray(l.aliases, `mapping.liabilities[${i}].aliases`).map(
    (a, j) => asString(a, `mapping.liabilities[${i}].aliases[${j}]`),
  );
  if (aliases.length === 0) {
    throw new Error(`mapping.liabilities[${i}].aliases must be non-empty`);
  }
  return {
    canonicalName: asString(
      l.canonicalName,
      `mapping.liabilities[${i}].canonicalName`,
    ),
    aliases,
  };
}

function parseMappedCategory(raw: unknown, i: number): MappedCategory {
  const c = asObject(raw, `mapping.categories[${i}]`);
  const kind = c.kind;
  if (kind !== "expense" && kind !== "savings" && kind !== "income") {
    throw new Error(
      `mapping.categories[${i}].kind must be expense|savings|income, got ${JSON.stringify(kind)}`,
    );
  }
  const aliases = asArray(c.aliases, `mapping.categories[${i}].aliases`).map(
    (a, j) => asString(a, `mapping.categories[${i}].aliases[${j}]`),
  );
  if (aliases.length === 0) {
    throw new Error(`mapping.categories[${i}].aliases must be non-empty`);
  }
  return {
    canonicalName: asString(
      c.canonicalName,
      `mapping.categories[${i}].canonicalName`,
    ),
    kind,
    icon: asString(c.icon, `mapping.categories[${i}].icon`),
    aliases,
    activeFrom: c.activeFrom ? asYearMonth(c.activeFrom, `mapping.categories[${i}].activeFrom`) : undefined,
    activeUntil: c.activeUntil ? asYearMonth(c.activeUntil, `mapping.categories[${i}].activeUntil`) : undefined,
  };
}

export function parseOverrides(raw: unknown): OverridesConfig {
  if (raw === undefined || raw === null) return { cells: {}, refundKeywords: [] };
  const obj = asObject(raw, "overrides");
  const cells: OverridesConfig["cells"] = {};
  const rawCells = asObject(obj.cells ?? {}, "overrides.cells");
  for (const [key, value] of Object.entries(rawCells)) {
    cells[key] = asArray(value, `overrides.cells['${key}']`).map((o, i) =>
      parseLineOverride(o, `overrides.cells['${key}'][${i}]`),
    );
  }
  const refundKeywords = asArray(
    obj.refundKeywords ?? [],
    "overrides.refundKeywords",
  ).map((k, i) => asString(k, `overrides.refundKeywords[${i}]`));
  return { cells, refundKeywords };
}

function parseLineOverride(raw: unknown, path: string) {
  const o = asObject(raw, path);
  const line = asInt(o.line, `${path}.line`);
  const reason = asString(o.reason, `${path}.reason`);
  switch (o.action) {
    case "skip":
      return { line, action: "skip" as const, reason };
    case "sign-flip":
      return { line, action: "sign-flip" as const, reason };
    case "set-amount":
      return {
        line,
        action: "set-amount" as const,
        amountCents: asInt(o.amountCents, `${path}.amountCents`),
        reason,
      };
    case "set-date":
      return {
        line,
        action: "set-date" as const,
        month: asIntInRange(o.month, `${path}.month`, 1, 12),
        day: asIntInRange(o.day, `${path}.day`, 1, 31),
        reason,
      };
    case "add-line":
      return {
        line,
        action: "add-line" as const,
        day: asIntInRange(o.day, `${path}.day`, 1, 31),
        ...(o.month !== undefined
          ? { month: asIntInRange(o.month, `${path}.month`, 1, 12) }
          : {}),
        amountCents: asInt(o.amountCents, `${path}.amountCents`),
        ...(o.vendor !== undefined ? { vendor: asString(o.vendor, `${path}.vendor`) } : {}),
        ...(o.note !== undefined ? { note: asString(o.note, `${path}.note`) } : {}),
        reason,
      };
    default:
      throw new Error(`${path}.action invalid: ${JSON.stringify(o.action)}`);
  }
}

export function parseIncome(raw: unknown): IncomeConfig {
  if (raw === undefined || raw === null) return { sources: [] };
  const obj = asObject(raw, "income");
  const sources = asArray(obj.sources ?? [], "income.sources").map((s, i) => {
    const src = asObject(s, `income.sources[${i}]`);
    const cadence = src.payCadence;
    if (
      cadence !== "weekly" &&
      cadence !== "bi-weekly" &&
      cadence !== "semi-monthly" &&
      cadence !== "monthly"
    ) {
      throw new Error(`income.sources[${i}].payCadence invalid: ${JSON.stringify(cadence)}`);
    }
    const grossRaw = asObject(
      src.annualGrossByYear,
      `income.sources[${i}].annualGrossByYear`,
    );
    const annualGrossByYear: Record<string, number> = {};
    for (const [year, gross] of Object.entries(grossRaw)) {
      if (!/^\d{4}$/.test(year)) {
        throw new Error(`income.sources[${i}].annualGrossByYear key not a year: ${year}`);
      }
      annualGrossByYear[year] = asNumber(
        gross,
        `income.sources[${i}].annualGrossByYear['${year}']`,
      );
    }
    return {
      canonicalName: asString(src.canonicalName, `income.sources[${i}].canonicalName`),
      icon: asString(src.icon, `income.sources[${i}].icon`),
      payCadence: cadence as IncomeSourceConfig["payCadence"],
      firstPaycheckDate: src.firstPaycheckDate
        ? asString(src.firstPaycheckDate, `income.sources[${i}].firstPaycheckDate`)
        : undefined,
      annualGrossByYear,
    };
  });
  return { sources };
}

function assertUniqueAliases(categories: MappedCategory[]): void {
  const seen = new Map<string, string>();
  for (const c of categories) {
    for (const alias of c.aliases) {
      const key = alias.trim().toLowerCase();
      const existing = seen.get(key);
      if (existing && existing !== c.canonicalName) {
        throw new Error(
          `mapping alias "${alias}" is claimed by both "${existing}" and "${c.canonicalName}"`,
        );
      }
      seen.set(key, c.canonicalName);
    }
  }
}

function assertUniqueLiabilityAliases(liabilities: MappedLiability[]): void {
  const seen = new Map<string, string>();
  for (const l of liabilities) {
    for (const alias of l.aliases) {
      const key = alias.trim().toLowerCase();
      const existing = seen.get(key);
      if (existing && existing !== l.canonicalName) {
        throw new Error(
          `liability alias "${alias}" is claimed by both "${existing}" and "${l.canonicalName}"`,
        );
      }
      seen.set(key, l.canonicalName);
    }
  }
}

function assertSkipRowsDisjoint(
  skipRows: string[],
  categories: MappedCategory[],
): void {
  const aliasKeys = new Set<string>();
  for (const c of categories) {
    for (const alias of c.aliases) aliasKeys.add(alias.trim().toLowerCase());
  }
  for (const row of skipRows) {
    if (aliasKeys.has(row.trim().toLowerCase())) {
      throw new Error(
        `skipRow "${row}" is also a category alias — a label can't be both mapped and skipped`,
      );
    }
  }
}

// ── tiny structural assertions ───────────────────────────────────────────────

function asObject(v: unknown, path: string): Record<string, unknown> {
  if (typeof v !== "object" || v === null || Array.isArray(v)) {
    throw new Error(`${path} must be an object`);
  }
  return v as Record<string, unknown>;
}
function asArray(v: unknown, path: string): unknown[] {
  if (!Array.isArray(v)) throw new Error(`${path} must be an array`);
  return v;
}
function asString(v: unknown, path: string): string {
  if (typeof v !== "string" || v.trim() === "") {
    throw new Error(`${path} must be a non-empty string`);
  }
  return v;
}
function asNumber(v: unknown, path: string): number {
  if (typeof v !== "number" || !Number.isFinite(v)) {
    throw new Error(`${path} must be a finite number`);
  }
  return v;
}
function asInt(v: unknown, path: string): number {
  const n = asNumber(v, path);
  if (!Number.isInteger(n)) throw new Error(`${path} must be an integer`);
  return n;
}
function asIntInRange(v: unknown, path: string, min: number, max: number): number {
  const n = asInt(v, path);
  if (n < min || n > max) throw new Error(`${path} must be an integer ${min}–${max}, got ${n}`);
  return n;
}
function asYearMonth(v: unknown, path: string): string {
  const s = asString(v, path);
  if (!/^\d{4}-\d{2}$/.test(s)) throw new Error(`${path} must be "YYYY-MM"`);
  return s;
}
