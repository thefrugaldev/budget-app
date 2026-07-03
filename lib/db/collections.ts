export const COLLECTIONS = {
  categories: "categories",
  categoryTargets: "categoryTargets",
  transactions: "transactions",
  // App-level state that is not user data — e.g. the auto-seed marker the
  // danger-zone reset sets so a deliberately-emptied DB is not re-seeded.
  meta: "meta",
  // Auth + tenancy (#111 chunk 2). See ADR 0004.
  users: "users",
  households: "households",
  members: "members",
  invites: "invites",
} as const;
