<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:package-manager -->
# Package manager: pnpm

This repo uses **pnpm** (`packageManager: pnpm@11.5.2` in `package.json`; `pnpm-lock.yaml` is the only lockfile). Use `pnpm` for project commands — `pnpm install`, `pnpm dev`, `pnpm test`, `pnpm lint`. Never `npm` or `yarn`; mixing produces a competing lockfile and install drift. `npx` is package-manager-agnostic and safe to use, but prefer `pnpm exec <bin>` or `pnpm dlx <pkg>` for clarity.
<!-- END:package-manager -->

<!-- BEGIN:code-organization -->
# Code organization

Four principles apply across **every** top-level source directory (`components/`, `hooks/`, `lib/`, `types/`). They're the same idea expressed at four levels of zoom.

**1. One thing per file.** A file exports one logical unit. For `components/`, that's one `PascalCase` component (no private nested sub-components — extract them). For `hooks/`, one `useFoo`. For `lib/`, one cohesive set of pure helpers around a single concept (a `parseX` and a `formatX` can co-habit; two unrelated families shouldn't). For `types/`, one domain area's type set. Helpers and types strictly internal to that one unit may stay co-located; anything reusable moves.

**2. Group by module, not by kind, inside each directory.** Don't dump every file flat at the root of a directory, and don't go to the other extreme of one folder per file. Files that belong to the same feature live next to each other in a module subfolder: income files under `components/budget/income/` and `lib/income/` (or grow `lib/income.ts` into `lib/income/` when it earns it), category files under `components/budget/category/` and `lib/category.ts`, and so on. The module names should track the language model in [[CONTEXT.md]] — Category, Income, Transaction, Vendor, etc.

**3. Co-locate related, separate unrelated.** Tests live next to the source they cover (`lib/budget/index.test.ts` next to `lib/budget/index.ts`). Pure helpers used by one component may stay co-located in that component's file or module. The granularity is "you'd open these files in the same minute" — if you would, they should be neighbours; if not, they shouldn't.

**4. Dedicated home per kind.** `components/` is for rendered surface area, `hooks/` for React hooks, `lib/` for pure helpers and business logic, `types/` for shared type definitions, `app/` for App Router routes only. Don't mix kinds within one directory: a hook does not live under `components/`, a pure helper does not live under `hooks/`. Imports use the matching alias (`@/components/...`, `@/hooks/...`, `@/lib/...`, `@/types/...`).

**File naming: one casing per kind.** A new file's name is decided by *where it lives*, not by whichever nearby file the author copied — the trap that drifted `categoryTargets.ts`/`iconCatalog.ts`/`roleContext.ts` into camelCase against an otherwise kebab `lib/`. The rule: `types/` and `lib/` are **kebab-case** (`fire-assumptions.ts`, `target-suggestion.ts`); `hooks/` is **`useXxx`** for a hook and kebab for a non-hook (`role-context.ts`); `components/` is **PascalCase** for a `.tsx` component and kebab for a `.ts` helper. A Mongo collection *constant* stays camelCase (its on-disk name), but the repository *file* that owns it is kebab like the rest of `lib/` — the `fire-assumptions.ts` → `fireAssumptions` split. `app/` is exempt (Next.js App Router dictates its filenames). `pnpm lint:names` enforces this (sanctioned exceptions — shadcn's `button.tsx`, the co-located `dialogClasses.ts`/`roleLabels.ts` constants — are an allowlist in `scripts/check-file-naming.mjs`).

**Shared infrastructure is shared from day one.** A unit that more than one consumer could reasonably use goes to its shared home on first introduction — not co-located with its first caller and lifted later. When in doubt, extract on first use rather than second.

**Charts compose from shared primitives.** Charting recurs across the app (spend/savings today; Net Worth and FIRE later), so build chart components to be shareable wherever it's reasonable rather than one-off per surface. Pure geometry (value→pixel scales, banding) lives in `lib/charts` (`scale.ts` — `domainMax`/`linearScale`/`bandScale`); genuinely reusable presentational pieces belong at an app-level `components/charts/`, not under a feature folder. Prefer composing small primitives over a single configurable mega-chart: a config-driven `<BarChart>` bakes in bar assumptions a future line/area chart can't use, spawning a second abstraction anyway. Prior art: `GrowthColumns` and `MonthBarChart` both draw from `lib/charts/scale.ts`.

**Clarifications (from the #48 audit — these are the traps that recurred):**

- **A React hook never lives inside a component file.** The moment a `useFoo` exists — even a tiny one tucked above the component that uses it — it goes to `hooks/useFoo.ts`. A hook is reusable infrastructure by nature; co-locating it hides it from the next consumer.
- **Don't clone an existing unit.** Before adding a hook or helper, check whether one already does the job. If you need a slightly different shape, generalise the existing unit (e.g. accept a structural type instead of a named one) rather than copying it under a new name. Two near-identical units are a defect — the next agent won't know which to use.
- **Barrels expose a public API, not everything.** A module `index.ts` re-exports only what outside callers actually consume. Don't re-export types or internals "just in case" — dead re-exports obscure the dependency graph (consumers should import types straight from `@/types/...`).
- **Accepted exceptions to "dedicated home per kind":** a co-shipping component family that upstream deliberately keeps together (shadcn `Card`-style sets), and small presentation-only constants tightly bound to a single UI module (e.g. `components/ui/dialogClasses.ts`, shared modal class strings). These stay co-located by design. Anything carrying real logic does not qualify — it moves to `lib/`.
- **A type imported by another file belongs in `types/`.** The test is consumption, not size: a `type`/`interface` used only inside its own file is internal and may stay co-located; the moment a second file imports it, it's shared and moves to `@/types/...`, imported from there (never re-exported through a `lib/` barrel). Move the whole **type family** together — if `TransactionRow = SingleRow | CollapsedStreak` and any member is shared, all of it goes, so the cohesive set isn't split across directories. **Accepted co-located exceptions** (shared but kept with their unit): a component's own `*Props`, a server action's `*ActionState`, a persistence `*Document` shape, and a hook's own public return type — each is the interface of the one unit it sits in. `pnpm lint:types` enforces this (allowlist in `scripts/check-type-placement.mjs`).

These conventions are enforced by review, not by tooling (with the narrow exception of `pnpm lint:types` for the rule above). New and touched files should follow them.
<!-- END:code-organization -->

<!-- BEGIN:design-accessibility-baseline -->
# Design & accessibility baseline

The non-negotiables every new or touched UI surface must satisfy. Enforced by review, like the code-organization rules above. This section has two halves: the **Accessibility** half below (established by #79) and a **Design / visual identity** half owned by the identity work (#80) — keep them as separate subsections so neither rewrites the other.

## Accessibility

- **Respect reduced motion.** Animation and transition are curtailed globally under `prefers-reduced-motion: reduce` by a single layer in `app/globals.css` — lean on it rather than adding per-component handling, and never ship motion that ignores it. Add a component-level override only where an animation is genuinely load-bearing (carries meaning), and say why.
- **Keep `color-scheme` and `theme-color` in sync with the theme.** `:root` and `.dark` declare `color-scheme` so native controls (date pickers, scrollbars, form fields) follow the active theme; the `viewport` export in `app/layout.tsx` sets light/dark `themeColor` so mobile browser chrome matches the background. Any new theme updates both.
- **Never communicate state by color alone.** Status must also carry text (a word or abbreviation) or a shape — an unlabeled icon or a bare color swatch is not enough for colorblind or assistive-tech users — and the same state must reach screen readers (e.g. `aria-valuetext` on the threshold meter carries the descriptor word, not just the bar colour). Prior art: the text-bearing `thresholdDescriptor` in `lib/budget` (honoring the expense/savings meaning-flip) and the nav "Soon" badge (a word, not a colored dot).
- **Preserve visible focus.** Interactive elements keep a visible focus indicator — use `focus-visible:ring-2 focus-visible:ring-ring`; don't strip an outline without an equivalent replacement.
- **Label every input.** Each control has a real associated label (`<label htmlFor>` or `aria-label`); placeholder text is never the only label.
- **The `<h1>` is the page *subject*, not the hero figure.** Every page/state carries exactly one `<h1>`, and it names what the page is about (the eyebrow — "Net worth", "FIRE") so a screen reader landing on it hears the subject, not a bare number. The big display-face marquee figure beneath it is a decorated **non-heading** (`<p>`), not the `<h1>` — a hero styled as an `<h1>` reads to assistive tech as "heading: $211,548", which is meaningless out of context. Headings then descend without skips (`h1` → section `h2`s via `SectionHeading`). Prior art: `NetWorthHero` and `FireKpiStrip` (the eyebrow is the class-identical `<h1>`; the figure is the `<p>`).
- **Virtualize lists once they get long or heavy.** Window a list when it can grow past a few hundred simple rows, past ~50 when the rows are complex or the surface is scroll-heavy (sticky day headers, selection mode, swipe menus, inline charts), or sooner if it visibly stutters on scroll or measurably hurts first paint — the row count is a guide, the symptom is the real trigger. Don't add windowing to a short or trivial list for its own sake. Prior art: the day-grouped transaction list via `@tanstack/react-virtual`. Windowing must preserve keyboard semantics — roving tabindex, selection, and focus reachability.

## Design / visual identity

The app's identity is **Harvest** — a warm, no-gray palette organized around progress against a **Target**. It is captured in full, with rationale, in [docs/adr/0002-harvest-design-language.md](docs/adr/0002-harvest-design-language.md); the ADR is the reference, and the rules below are the non-negotiables. The whole point of this section is that review missed the original shadcn drift for the app's entire life — so the identity is codified and, where possible, mechanically guarded (`pnpm lint:design`) rather than left to memory.

- **Consume tokens, never hard-code color.** `app/globals.css` (`:root`/`.dark` + `@theme inline`) is the *only* home for raw color literals. Everywhere else, use a token utility (`bg-primary`, `text-signal-bad-foreground`, `ring-signal-warn/30`) or `var(--token)` — never a hex, `rgb()`, `oklch()`, etc., and never a Tailwind default-palette utility (`bg-rose-600`, `text-zinc-500` — those are shadcn remnants). `pnpm lint:design` fails CI on raw literals outside the token file; the rare sanctioned exception (the `themeColor` viewport export, which must mirror `--background`) opts out per-line with a `design-lint-allow` comment stating why.
- **Reserve the display face for hero figures and key headings.** Bricolage Grotesque (`--font-heading`, tiers `text-hero` / `text-display`) is applied with restraint — Pulse KPI values, the Category total, page titles — not body or data tables. Body is Nunito (`--font-sans`); numerals keep `tabular-nums`. Don't reach for the display face on card totals, dialog titles, or section headers — those stay on the stock `text-*` scale.
- **Icons are Lucide, tinted via tokens — no emoji.** Use `lucide-react` (following the existing `CategoryIcon`/`iconCatalog` mapping) so iconography is consistent on every device and follows the palette. A new category id must resolve to an icon (no blanks) — `lib/category/icon.test.ts` guards this.
- **Signal colors are a fill/text pair, reconciled into the palette.** `--signal-{good,warn,bad}` is the fill/bar tone (on `--muted`); `-foreground` is the text tone (contrast-safe on `--card`). Use the right half for the right job. Signal semantics come from one source — `thresholdDescriptor`/`barTone` in `lib/budget` (expense→cap-pressure, savings→progress) — so meter, Pulse, and trend never disagree; don't invent a parallel color mapping. `--signal-bad` intentionally equals `--destructive` but stays a distinct token.
- **Scope transitions; never `transition-all`.** Animate the properties that actually move (`transition-colors`, `transition-transform`). `transition-all` animates layout and color too, fighting the reduced-motion baseline and masking jank — `pnpm lint:design` rejects it.
- **New surfaces extend the identity, they don't re-theme.** A new page/component should look designed by consuming the same tokens, type roles, chart primitives (`lib/charts`), and signal model — not by introducing its own colors or a one-off chart. When the identity genuinely needs to grow (a new token, a new chart primitive), add it to the shared home and note the decision in the ADR.
<!-- END:design-accessibility-baseline -->

# Authorization: viewer read-only (roles owner > editor > viewer)

Established by #111 chunk 7. Two rules bind every new surface that mutates data:

- **The server is the boundary; the UI only hides.** Every mutating server action calls `requireRole(...)` (`lib/auth/require-role.ts`) — that is what makes access real. Hiding a button is never the security check; it's UX, so a viewer isn't shown affordances that would only 403.
- **Hide with `useCanEdit()`, absent not disabled.** Client components read `useCanEdit()` (`hooks/useCanEdit.ts`, fed by `RoleProvider` in the authenticated layout) and *omit* edit affordances for viewers — `return null` for a pure-affordance component, or drop the specific trigger in a mixed one. Never render a greyed-out/disabled control (story 9). A missing provider fails closed to read-only.
- **Server components gate directly on the session.** A server component or loader that renders an owner/editor-only *section* branches inline on `getSession()`'s `membership.role` (e.g. the Settings page hides Members & Invites + the Danger zone for non-owners) — `useCanEdit()` is a client hook and can't run there. Same boundary either way; pick by where the code runs. The matrix's last two rows are server-gated; the rest are client-hidden.

**Manual role-matrix check (run for any UI-touching PR that adds a mutating affordance).** As a **viewer**, none of these may appear; as **editor/owner** they do:

| Surface | Affordance hidden from viewers |
| --- | --- |
| Pulse / any page | Floating "+" Add menu; inline "+ Add category" tiles |
| Transactions list | Row ⋯ (Edit/Delete); "Select" → bulk bar; long-press/Space selection; empty-state "Add a transaction" |
| Category detail | Edit pencil; ⋯ lifecycle (End/Reopen/Delete); "Add transaction" card; Edit sheet (targets) |
| Income | Add-source button (header + empty state); per-card Edit pencil; ⋯ (End/Cancel/Reopen/Delete) |
| Settings | Ended-category "Reopen"; Members & Invites + Danger zone (owner-only, server-gated in the page) |

Read surfaces (viewing data, CSV export, theme, sign-out) stay available to everyone.

**Carry-forward (surfaces not built yet):** when the FIRE assumptions UI lands (#110), viewers keep the knobs *interactive* but the **Save** affordance is hidden and persistence is server-rejected (story 10); when the net-worth **check-in** mode lands (#109), it's hidden for viewers. Both reuse `useCanEdit()`.
