export const COLLECTIONS = {
  categories: "categories",
  categoryTargets: "categoryTargets",
  transactions: "transactions",
  // App-level state that is not user data — e.g. the auto-seed marker the
  // danger-zone reset sets so a deliberately-emptied DB is not re-seeded.
  meta: "meta",
  // Net Worth (#109 chunk 2). Accounts + their valuation snapshots.
  accounts: "accounts",
  snapshots: "snapshots",
  // App-global market-quote cache (#109 chunk 3) — not household data.
  quotes: "quotes",
  // Auth + tenancy (#111 chunk 2). See ADR 0004.
  users: "users",
  households: "households",
  members: "members",
  invites: "invites",
} as const;
