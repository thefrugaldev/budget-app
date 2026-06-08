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

## Production (Vercel + Atlas)

The free Atlas M0 tier (512 MB shared) is enough for a single-user budget app.

### One-time Atlas setup

1. Create a free **M0 cluster** at [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Under **Database Access**, create a user (username + password)
3. Under **Network Access**, allow Vercel's egress — easiest is `0.0.0.0/0` (open to the internet, gated by the user/password)
4. Click **Connect → Drivers** and copy the `mongodb+srv://...` connection string. Substitute your user's password into the placeholder.

### Vercel env vars

In your Vercel project's **Settings → Environment Variables**, add:

| Name | Value |
|---|---|
| `MONGODB_URI` | the `mongodb+srv://...` URI from Atlas |
| `MONGODB_DB_NAME` | `budget` |

Redeploy. On the first request, `ensureSeeded()` populates the new DB; subsequent requests no-op.

### Why separate `MONGODB_DB_NAME` in dev vs prod?

Same code, separate datasets. Dev iterates against `budget-dev` locally; prod points at `budget` in Atlas. If you ever want both on the same cluster, just change one env var.

## Browsing the data

- **MongoDB Compass** (GUI): point at your URI, browse collections
- **mongosh** (CLI): `mongosh "mongodb://localhost:27017/budget-dev"`

Collections: `categories`, `categoryTargets`, `transactions`.

## Storage portability (Atlas → Cosmos DB later)

Uses the official `mongodb` driver behind a thin repository layer so the app never talks to Atlas-specific APIs directly. When you outgrow 512 MB, migration is mostly operational:

1. Create an Azure Cosmos DB account with **MongoDB API** (free tier available)
2. `mongodump` from Atlas → `mongorestore` into Cosmos (same collections)
3. Update `MONGODB_URI` in Vercel env vars
4. Set `MONGODB_RETRY_WRITES=false` if your Cosmos account requires it

**Portability rules baked into the data layer**

- String UUID `_id` fields (not ObjectId)
- Simple CRUD + `$match` / `$group` aggregations only
- No `$lookup`, text search, or Atlas-only features
- Category names joined in app code, not DB

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
