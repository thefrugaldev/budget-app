#!/usr/bin/env node
/**
 * Guardrail for the AGENTS.md design baseline: the identity lives in tokens, so
 * nothing outside the token file may hard-code a color, and no surface may use
 * the unscoped `transition-all` (it animates every property — including layout
 * and color — defeating the reduced-motion baseline's intent and masking jank).
 *
 * Two checks, run over `app`, `components`, `hooks`, `lib`, `types`
 * (`.ts`/`.tsx`/`.css`, tests excluded):
 *
 *   1. Raw color literal — a hex (`#abc`…`#aabbccdd`) or a CSS color function
 *      (`rgb()`/`rgba()`/`hsl()`/`hsla()`/`hwb()`/`lab()`/`lch()`/`oklab()`/
 *      `oklch()`) anywhere but the token file. Components consume tokens
 *      (`bg-primary`, `text-signal-bad-foreground`, `var(--chart-1)`), never
 *      literals — see docs/adr/0002-harvest-design-language.md.
 *   2. `transition-all` — always scope transitions to the properties that move
 *      (`transition-colors`, `transition-transform`, …).
 *
 * The token file `app/globals.css` is the one authorized home for literals and
 * is exempt. A rare legitimate literal elsewhere (e.g. the `themeColor` viewport
 * export, which must mirror `--background` for browser chrome) opts out per-line
 * with a `design-lint-allow` comment stating why.
 *
 * Comments are blanked before scanning (preserving line numbers) so an issue
 * ref like `#104` or a hex named in a doc comment never false-matches. Exit 1
 * on any violation so CI blocks new drift back toward the shadcn default theme.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, relative } from "node:path";

const ROOTS = ["app", "components", "hooks", "lib", "types"];

// The single authorized home for raw color literals — the palette itself.
const TOKEN_FILES = new Set(["app/globals.css"]);

// Per-line escape hatch for the rare sanctioned literal outside the token file.
const ALLOW = /design-lint-allow/;

const HEX = /#[0-9a-fA-F]{3,8}\b/;
const COLOR_FN = /\b(?:rgb|rgba|hsl|hsla|hwb|lab|lch|oklab|oklch)\(/;
const TRANSITION_ALL = /\btransition-all\b/;

/**
 * Replace every comment character with a space, leaving newlines intact, so the
 * result is the same length and shape as the input (line numbers stay aligned)
 * but carries no comment text. The `[^:]` guard before `//` leaves `https://`
 * (and other `://`) alone. Handles CSS/JS block comments and JS line comments;
 * CSS has no line comments, so the `//` rule is a no-op there.
 */
export function blankComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/(^|[^:])\/\/[^\n]*/g, (_m, p1) => p1 + " ".repeat(_m.length - p1.length));
}

/**
 * Scan one file's source for violations. Returns `{ line, rule, match }[]`.
 * Detection runs on the comment-blanked text; the `design-lint-allow` opt-out is
 * read from the original line (the marker lives in a comment, which blanking
 * would otherwise erase).
 */
export function scanSource(src) {
  const rawLines = src.split("\n");
  const lines = blankComments(src).split("\n");
  const violations = [];
  for (let i = 0; i < lines.length; i++) {
    if (ALLOW.test(rawLines[i])) continue;
    const line = lines[i];
    const color = line.match(HEX) ?? line.match(COLOR_FN);
    if (color) violations.push({ line: i + 1, rule: "color-literal", match: color[0] });
    const anim = line.match(TRANSITION_ALL);
    if (anim) violations.push({ line: i + 1, rule: "transition-all", match: anim[0] });
  }
  return violations;
}

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(?:tsx?|css)$/.test(full) && !/\.test\.tsx?$/.test(full)) out.push(full);
  }
  return out;
}

function main() {
  const files = ROOTS.flatMap((r) => {
    try {
      return walk(r);
    } catch {
      return [];
    }
  }).filter((f) => !TOKEN_FILES.has(relative(process.cwd(), f)));

  const violations = [];
  for (const file of files) {
    for (const v of scanSource(readFileSync(file, "utf8"))) {
      violations.push({ ...v, file });
    }
  }

  if (violations.length > 0) {
    console.error("Design-token violations (see docs/adr/0002-harvest-design-language.md):\n");
    for (const v of violations) {
      const why =
        v.rule === "color-literal"
          ? `raw color "${v.match}" — use a token (bg-*/text-*/var(--*)) or add a design-lint-allow comment with a reason`
          : `"${v.match}" — scope the transition to the properties that move`;
      console.error(`  ${v.file}:${v.line}  ${why}`);
    }
    console.error(`\n${violations.length} violation(s). The identity is token-driven; literals live only in app/globals.css.`);
    process.exit(1);
  }

  console.log("design-tokens: ok — no raw color literals or transition-all outside the token file.");
}

// Run the CLI only when invoked directly; stay import-safe for the unit test.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main();
}
