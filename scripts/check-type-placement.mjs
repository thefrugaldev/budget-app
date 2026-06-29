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
 *   - persistence document shapes (`*Document`)
 *   - a hook's own public return type (one per hook, named in ALLOWLIST)
 *   - small presentation-only unions bound to one UI unit (named in ALLOWLIST)
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

const isExempt = (name) =>
  ALLOWLIST.has(name) ||
  name.endsWith("Props") ||
  name.endsWith("ActionState") ||
  name.endsWith("Document");

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
    // Imported by another file? (the symbol appears in an import statement
    // somewhere other than its declaring file)
    const importRe = new RegExp(`import[^;]*\\b${name}\\b[^;]*from`, "s");
    const sharedBy = [...sources].find(
      ([f, t]) => f !== file && importRe.test(t),
    );
    if (sharedBy) {
      violations.push({ name, file, importedBy: sharedBy[0] });
    }
  }
}

if (violations.length > 0) {
  console.error("Shared types must live in types/ (see AGENTS.md):\n");
  for (const v of violations) {
    console.error(`  ${v.name}  (${v.file})  imported by ${v.importedBy}`);
  }
  console.error(
    `\n${violations.length} shared type(s) declared outside types/. Move them to @/types/… and import from there.`,
  );
  process.exit(1);
}

console.log("type-placement: ok — no shared types outside types/.");
