/**
 * Locale-independent string comparison for deterministic output. `localeCompare`
 * (no args) uses the runtime's default ICU locale, so the same input can serialize
 * to different byte layouts across environments (`LANG=C` vs `en_US.UTF-8`) or
 * after an ICU update — which would break the importer's byte-stability
 * guarantee. Code-point order is fixed everywhere.
 */
export function compareStrings(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
