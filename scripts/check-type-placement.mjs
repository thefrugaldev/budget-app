#!/usr/bin/env node
/**
 * Guardrail for the AGENTS.md rule: shared type definitions live in `types/`.
 *
 * A type declared in `lib/`, `components/`, `hooks/`, or `app/` that is imported
 * by *another* file is "shared" and belongs in `types/`. Types used only within
 * their own file are internal and may stay co-located.
 *
 * Some kinds are deliberately co-located even when shared (see AGENTS.md):
 *   - component prop types (`*Props`)
 *   - server-action state (`*ActionState`)
 *   - a hook's own public return type (one per hook, named in ALLOWLIST)
 *   - small presentation-only unions bound to one UI unit (named in ALLOWLIST)
 *
 * Persistence document shapes (`*Document`) are also co-located, but on a
 * *tighter* leash: they may only be imported within the data layer (`lib/db`,
 * `lib/repositories`). The moment a `*Document` is imported anywhere else it has
 * drifted into a de-facto domain type used across the app — the mapper seam has
 * been bypassed — so it's flagged. Extract the domain shape to `types/` and map
 * to it. This catches the persistence→domain drift a purely name-based
 * exemption cannot (a `*Document` stays trusted by name no matter how it's used).
 *
 * Anything else that's shared but sits outside `types/` is flagged. Exit 1 on
 * any violation so CI blocks new drift.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOTS = ["lib", "components", "hooks", "app"];

// Cross-module types that are intentionally co-located by name (hook return
// types, UI-bound unions). Pattern-based exemptions (*Props etc.) are below.
const ALLOWLIST = new Set([
  "TransactionSelection", // hooks/useTransactionSelection.ts — the hook's own public return type
  "AmountUnit", // components/budget/income/RecurringAmountField.tsx — UI-only union bound to one field
]);

// Unconditionally co-located (any importer is fine). `*Document` is handled
// separately below — it's co-located too, but only when imported within the
// data layer.
const isExempt = (name) =>
  ALLOWLIST.has(name) ||
  name.endsWith("Props") ||
  name.endsWith("ActionState");

// The only place a persistence `*Document` shape may be consumed: the data layer
// (documents/mappers/indexes/repositories). Anywhere else means it's leaked past
// the mapper into domain/UI code.
const isDataLayer = (file) => /(^|\/)lib\/(db|repositories)\//.test(file);

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(full) && !/\.test\.tsx?$/.test(full)) out.push(full);
  }
  return out;
}

const files = ROOTS.flatMap((r) => {
  try {
    return walk(r);
  } catch {
    return [];
  }
});
// Strip comments so a commented-out `import`/`export type` can't false-match.
// The `[^:]` guard before `//` leaves `https://` (and other `://`) intact.
// Line/block-aware, not syntax-aware: a `//` inside a regex literal on the same
// line as a type decl/import could mis-strip. No such literals exist in the
// scanned dirs; a real tokenizer would be overkill here. If the guard ever
// flags something baffling, suspect a regex literal on a declaration line.
const stripComments = (s) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");

const sources = new Map(
  files.map((f) => [f, stripComments(readFileSync(f, "utf8"))]),
);

const declRe = /^export\s+(?:type|interface)\s+([A-Za-z0-9_]+)/gm;
const violations = [];

for (const [file, text] of sources) {
  for (const match of text.matchAll(declRe)) {
    const name = match[1];
    if (isExempt(name)) continue;
    // Files that import this symbol (the name appears in an import statement in
    // a file other than the one declaring it).
    const importRe = new RegExp(`import[^;]*\\b${name}\\b[^;]*from`, "s");
    const importers = [...sources].filter(
      ([f, t]) => f !== file && importRe.test(t),
    );
    if (importers.length === 0) continue;

    if (name.endsWith("Document")) {
      // Co-located, but every importer must be in the data layer. Flag each one
      // that isn't — that's the persistence shape leaking into domain/UI code.
      for (const [f] of importers.filter(([f]) => !isDataLayer(f))) {
        violations.push({ name, file, importedBy: f, kind: "document-leak" });
      }
      continue;
    }

    violations.push({ name, file, importedBy: importers[0][0], kind: "misplaced" });
  }
}

if (violations.length > 0) {
  console.error("Type-placement violations (see AGENTS.md):\n");
  for (const v of violations) {
    if (v.kind === "document-leak") {
      console.error(
        `  ${v.name}  (${v.file})  imported by ${v.importedBy}\n` +
          `    → *Document shapes must stay in the data layer (lib/db, lib/repositories).\n` +
          `      Extract a domain type to @/types/… and map to it via mappers.ts.`,
      );
    } else {
      console.error(
        `  ${v.name}  (${v.file})  imported by ${v.importedBy}\n` +
          `    → shared type declared outside types/; move it to @/types/… and import from there.`,
      );
    }
  }
  console.error(`\n${violations.length} violation(s).`);
  process.exit(1);
}

console.log("type-placement: ok — no shared types outside types/.");
