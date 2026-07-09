import { createHash } from "node:crypto";

import type { ImportRefParts } from "./types";

/**
 * Provenance and deterministic ids (ADR 0005 decision 3). Every imported
 * document carries a human-readable `importRef` locating its exact source —
 * `"<file>!<sheet>!<cell>#<line>"`, e.g. `"2023.xlsx!2023!D14#3"` — and its
 * MongoDB `_id` is a hash of that ref. Deterministic ids are what make re-runs
 * a *sync* (upsert by id + delete orphaned refs) instead of an accumulation:
 * the same source line always maps to the same document, so editing 2026.xlsx
 * and re-importing updates in place rather than duplicating.
 */

/**
 * Build the human-readable importRef. The `!`/`#` separators are reserved: the
 * parts (a filename, sheet name, A1 cell, line number) never contain them, so
 * the ref both round-trips and reads cleanly in reports and reconciliation
 * output. `line` is 1-based (use `1` for a cell-level document such as a
 * savings monthly total or a liability snapshot).
 */
export function buildImportRef(parts: ImportRefParts): string {
  return `${parts.file}!${parts.sheet}!${parts.cell}#${parts.line}`;
}

/**
 * Hash an importRef into a stable document `_id`: the first 32 hex chars (128
 * bits) of its SHA-256. 128 bits is collision-free far beyond the ~8k imported
 * documents, and a shorter id keeps manifests and dumps readable. The full
 * `importRef` is stored alongside on the document for traceability, so the id
 * itself never needs to be reversed.
 */
export function hashImportRef(importRef: string): string {
  return createHash("sha256").update(importRef).digest("hex").slice(0, 32);
}

/** Convenience: the deterministic `_id` for a set of source coordinates. */
export function importRefId(parts: ImportRefParts): string {
  return hashImportRef(buildImportRef(parts));
}
