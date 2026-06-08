# Budget App

Next.js App Router app for tracking monthly spend by category. Deploy target: Vercel.

## Quick start (local dev)

```bash
corepack enable
pnpm install

# 1. Local Mongo (mac, Homebrew)
brew tap mongodb/brew
brew install mongodb-community
brew services start mongodb-community

# 2. Local env file
cp .env.example .env.local
# then edit .env.local — see below

pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). The first page load seeds the DB idempotently (`lib/db/seed.ts`); subsequent loads no-op.

### `.env.local` for local dev

```bash
MONGODB_URI=mongodb://localhost:27017
MONGODB_DB_NAME=budget-dev
```

The app reads `MONGODB_URI` and `MONGODB_DB_NAME` from any `.env*` file Next picks up. `.env.local` is the convention for machine-specific secrets and is gitignored.

## Production (Vercel + Cosmos DB for MongoDB vCore)

Prod runs on Azure Cosmos DB's MongoDB vCore free tier — 32 GB storage on a shared burstable VM, free forever as of writing. The codebase uses only Mongo-portable patterns (string UUID `_id`, `$match` + `$group` aggregations, no `$lookup`), so the app code is identical to running against any other Mongo endpoint.

### One-time Cosmos vCore setup

1. Sign in to the [Azure Portal](https://portal.azure.com) (requires a credit card for identity verification; the free tier does not charge it)
2. **Create a resource** → search "Azure Cosmos DB" → choose **Azure Cosmos DB for MongoDB** → **vCore**
3. Create a new cluster:
   - **Cluster tier**: select **Free tier (M25)** — 32 GB storage, shared burstable compute
   - **Admin username + password** — save these; they're embedded in the connection string
4. **Networking** → allow public access from the IP ranges you need. For Vercel, the easiest is **Allow public access from any Azure service** + adding `0.0.0.0` to `255.255.255.255`. (Tighten later if you want.)
5. Wait ~5 minutes for provisioning, then under **Connection strings** copy the `mongodb+srv://<user>:<password>@<cluster>...` URI. Replace `<password>` with the real password.

### Vercel env vars

In your Vercel project's **Settings → Environment Variables**, add:

| Name | Value |
|---|---|
| `MONGODB_URI` | the `mongodb+srv://...` URI from Cosmos |
| `MONGODB_DB_NAME` | `budget` |

Redeploy. On the first request, `ensureSeeded()` populates the new DB; subsequent requests no-op.

> If you ever switch the Cosmos account to the **RU-based** MongoDB API instead of vCore, set `MONGODB_RETRY_WRITES=false` — RU-based Cosmos doesn't support retryable writes. vCore does, so the default is fine.

### Why separate `MONGODB_DB_NAME` in dev vs prod?

Same code, separate datasets. Dev iterates against `budget-dev` on your laptop's local Mongo; prod points at `budget` in Cosmos. Swapping environments is one env-var change.

## Browsing the data

- **MongoDB Compass** (GUI): point at your URI, browse collections
- **mongosh** (CLI): `mongosh "mongodb://localhost:27017/budget-dev"`

Collections: `categories`, `categoryTargets`, `transactions`.

## Storage portability rules

The codebase keeps every query inside the subset of MongoDB that vCore (and RU-based Cosmos, and any other Mongo-compatible store) supports cleanly. If you ever need to switch backends, it should be a connection-string change, not a code change.

- String UUID `_id` fields (not ObjectId)
- Simple CRUD + `$match` / `$group` aggregations only
- No `$lookup`, text search, or store-specific features
- Category names joined in app code, not the DB

## UI

- [shadcn/ui](https://ui.shadcn.com/) for components — add via `pnpm dlx shadcn@latest add <component>`
- Tailwind v4 for styling — no custom CSS unless required for theme setup

## Project layout

```
app/                 routes (Pulse + category detail)
components/budget/   per-domain UI primitives
lib/budget.ts        pure aggregation functions (table-driven tests)
lib/db/              client, indexes, document shapes, seed
lib/repositories/    categories, categoryTargets, transactions, monthly-spend
types/budget.ts      domain types
docs/adr/            architecture decision records
```

## Scripts

```bash
pnpm dev          # next dev (Turbopack)
pnpm build        # production build
pnpm start        # next start
pnpm test         # vitest in watch mode
pnpm test --run   # one-shot test run
pnpm lint         # eslint
```
