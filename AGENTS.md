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

**One component per file.** Each React component (anything that renders JSX and is `PascalCase`) lives in its own `.tsx` file named after the component. No private sub-components nested inside the same file as their parent — extract them and import like any other dependency. Pure helpers and types specific to a single component may stay co-located, but additional components should not.

**Group components by module under `components/`.** Don't dump every file under a single flat directory, and don't go to the other extreme of one folder per file. Components that belong to the same feature live in a shared module subfolder — for example, income-related components under `components/budget/income/`, category-related ones under `components/budget/category/`. The right granularity is the one where related files sit next to each other and unrelated ones don't; when in doubt, follow the language model from `CONTEXT.md`.

**Hooks live in `hooks/`, not under `components/`.** A `.ts`/`.tsx` file that exports a `useFoo` belongs at the top-level `hooks/` directory, sibling to `components/`, `lib/`, and `app/`. This keeps the `components/` tree about *rendered surface area* and gives hooks a discoverable home regardless of which component first needed them. Import as `@/hooks/useFoo`. The notify package's own `useNotify` is a known interim exception pending the audit in #48.

**Shared infrastructure is shared from day one.** A hook or helper that more than one component could reasonably use belongs in its shared home (e.g. `hooks/`, `lib/budget/`, `lib/income/`) on first introduction — not co-located with its first consumer and lifted later. When in doubt, extract on first use rather than second.

These conventions are enforced by review, not by tooling. Some pre-existing files predate the rule — see #48 for the audit. New and touched files should follow it.
<!-- END:code-organization -->
