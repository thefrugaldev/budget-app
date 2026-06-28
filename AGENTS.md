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

**Shared infrastructure is shared from day one.** A unit that more than one consumer could reasonably use goes to its shared home on first introduction — not co-located with its first caller and lifted later. When in doubt, extract on first use rather than second.

**Clarifications (from the #48 audit — these are the traps that recurred):**

- **A React hook never lives inside a component file.** The moment a `useFoo` exists — even a tiny one tucked above the component that uses it — it goes to `hooks/useFoo.ts`. A hook is reusable infrastructure by nature; co-locating it hides it from the next consumer.
- **Don't clone an existing unit.** Before adding a hook or helper, check whether one already does the job. If you need a slightly different shape, generalise the existing unit (e.g. accept a structural type instead of a named one) rather than copying it under a new name. Two near-identical units are a defect — the next agent won't know which to use.
- **Barrels expose a public API, not everything.** A module `index.ts` re-exports only what outside callers actually consume. Don't re-export types or internals "just in case" — dead re-exports obscure the dependency graph (consumers should import types straight from `@/types/...`).
- **Accepted exceptions to "dedicated home per kind":** a co-shipping component family that upstream deliberately keeps together (shadcn `Card`-style sets), and small presentation-only constants tightly bound to a single UI module (e.g. `components/ui/dialogClasses.ts`, shared modal class strings). These stay co-located by design. Anything carrying real logic does not qualify — it moves to `lib/`.
- **A type imported by another file belongs in `types/`.** The test is consumption, not size: a `type`/`interface` used only inside its own file is internal and may stay co-located; the moment a second file imports it, it's shared and moves to `@/types/...`, imported from there (never re-exported through a `lib/` barrel). Move the whole **type family** together — if `TransactionRow = SingleRow | CollapsedStreak` and any member is shared, all of it goes, so the cohesive set isn't split across directories. **Accepted co-located exceptions** (shared but kept with their unit): a component's own `*Props`, a server action's `*ActionState`, a persistence `*Document` shape, and a hook's own public return type — each is the interface of the one unit it sits in. `pnpm lint:types` enforces this (allowlist in `scripts/check-type-placement.mjs`).

These conventions are enforced by review, not by tooling (with the narrow exception of `pnpm lint:types` for the rule above). New and touched files should follow them.
<!-- END:code-organization -->
