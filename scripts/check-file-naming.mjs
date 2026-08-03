#!/usr/bin/env node
/**
 * Guardrail for the AGENTS.md file-naming convention. Codifies the rule that
 * review kept re-litigating (and that drifted anyway — #186 review): one casing
 * per kind of file, so a new file's name is decided by where it lives, not by
 * which nearby file the author happened to copy.
 *
 *   types/       kebab-case                    net-worth.ts, target-suggestion.ts
 *   lib/         kebab-case                     fire-assumptions.ts, scoped-collection.ts
 *   hooks/       useXxx  (or kebab for non-hooks)  useCanEdit.ts, role-context.ts
 *   components/  PascalCase .tsx components;     CategoryDetailBody.tsx
 *                kebab-case .ts helpers          (dialog-classes.ts …)
 *
 * A Mongo collection *constant* stays camelCase (it's the collection's on-disk
 * name), but the repository *file* that owns it is kebab like the rest of lib/ —
 * exactly the fire-assumptions.ts → `fireAssumptions` split.
 *
 * `app/` is deliberately NOT scanned: its filenames are dictated by the Next.js
 * App Router (`page.tsx`, `layout.tsx`, `route.ts`, `[id]`, `(group)`, …), a
 * different convention that this rule would fight.
 *
 * Exit 1 on any violation so CI blocks new drift. Sanctioned exceptions live in
 * ALLOWLIST below, each with the reason it opts out.
 */
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOTS = ["lib", "hooks", "types", "components"];

// Files whose name intentionally departs from its directory's rule. Keyed by
// repo-relative path (not basename) so the exemption is precise.
const ALLOWLIST = new Map([
  // shadcn ships this lowercase; keeping it matches `npx shadcn add` output so
  // upstream updates diff cleanly.
  ["components/ui/button.tsx", "shadcn upstream filename"],
  // AGENTS.md-sanctioned co-located presentation constants (camelCase by history).
  ["components/ui/dialogClasses.ts", "sanctioned co-located constant (AGENTS.md)"],
  ["components/settings/roleLabels.ts", "sanctioned co-located constant (AGENTS.md)"],
]);

const KEBAB = /^[a-z0-9]+(-[a-z0-9]+)*\.tsx?$/; // lowercase words, hyphen-joined; single word ok
const PASCAL = /^[A-Z][A-Za-z0-9]*\.tsx?$/; // one PascalCase component per file
const HOOK = /^use[A-Z][A-Za-z0-9]*\.ts$/; // useCanEdit, useTickerSearch, …

/** The rule for a file, by the top-level root it lives under. Returns null if ok, else the expectation. */
function violation(root, base) {
  switch (root) {
    case "types":
    case "lib":
      return KEBAB.test(base) ? null : "kebab-case (e.g. fire-assumptions.ts)";
    case "hooks":
      return HOOK.test(base) || KEBAB.test(base)
        ? null
        : "useXxx for a hook, else kebab-case (e.g. role-context.ts)";
    case "components":
      if (base.endsWith(".tsx")) {
        return PASCAL.test(base) ? null : "PascalCase for a component (e.g. CategoryCard.tsx)";
      }
      return KEBAB.test(base) ? null : "kebab-case for a non-component helper (e.g. dialog-classes.ts)";
    default:
      return null;
  }
}

function walk(dir, out = []) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(full) && !/\.test\.tsx?$/.test(full)) out.push(full);
  }
  return out;
}

const violations = [];
for (const root of ROOTS) {
  for (const file of walk(root)) {
    if (ALLOWLIST.has(file)) continue;
    const base = file.slice(file.lastIndexOf("/") + 1);
    const expected = violation(root, base);
    if (expected) violations.push({ file, expected });
  }
}

if (violations.length > 0) {
  console.error("File-naming violations (see AGENTS.md → File naming):\n");
  for (const v of violations) {
    console.error(`  ${v.file}\n    → expected ${v.expected}`);
  }
  console.error(
    `\n${violations.length} violation(s). Rename the file (git mv) and update its importers, ` +
      `or add a documented exception to ALLOWLIST in scripts/check-file-naming.mjs.`,
  );
  process.exit(1);
}

console.log("file-naming: ok — every file matches its directory's casing convention.");
