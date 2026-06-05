# Budget App

Next.js App Router app for tracking monthly spend by category. Deploy target: Vercel.

## Setup

```bash
corepack enable
pnpm install
cp .env.example .env.local
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Storage (MongoDB Atlas → Cosmos DB)

Uses the official `mongodb` driver with a repository layer so the app never talks to Atlas-specific APIs directly.

**Atlas setup**

1. Create a free M0 cluster at [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Create a database user and allow your IP (or `0.0.0.0/0` for Vercel)
3. Copy the connection string into `.env.local` as `MONGODB_URI`

**Cosmos DB migration (later)**

When you outgrow 512MB, migration is mostly operational — no app rewrite:

1. Create Azure Cosmos DB account with **MongoDB API** (enable free tier)
2. `mongodump` from Atlas → `mongorestore` into Cosmos (same collections)
3. Update `MONGODB_URI` in Vercel env vars
4. Set `MONGODB_RETRY_WRITES=false` if your Cosmos account requires it

**Portability rules baked into the data layer**

- String UUID `_id` fields (not ObjectId)
- Simple CRUD + `$match` / `$group` aggregations only
- No `$lookup`, text search, or Atlas-only features
- Category names joined in app code, not DB

## Data layer

```
lib/db/           connection, indexes, document shapes
lib/repositories/ categories, transactions, monthly spend
```
