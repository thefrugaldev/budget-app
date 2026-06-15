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

**Shared hooks live with shared infrastructure, not with a single consumer.** A `useFoo` hook that more than one component could reasonably use belongs in the package that owns the concept (e.g. toast-related hooks under `components/notify/`, budget primitives under `lib/`). Don't define a hook inside the consumer file and then re-discover it later — when in doubt, extract on first use rather than second.

These conventions are enforced by review, not by tooling. Some pre-existing files predate the rule; new and touched files should follow it, and the broader repo will be migrated incrementally.
<!-- END:code-organization -->
