<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:package-manager -->
# Package manager: pnpm

This repo uses **pnpm** (`packageManager: pnpm@11.5.2` in `package.json`; `pnpm-lock.yaml` is the only lockfile). Use `pnpm` for project commands — `pnpm install`, `pnpm dev`, `pnpm test`, `pnpm lint`. Never `npm` or `yarn`; mixing produces a competing lockfile and install drift. `npx` is package-manager-agnostic and safe to use, but prefer `pnpm exec <bin>` or `pnpm dlx <pkg>` for clarity.
<!-- END:package-manager -->
