export const COLLECTIONS = {
  categories: "categories",
  categoryTargets: "categoryTargets",
  transactions: "transactions",
  // App-level state that is not user data — e.g. the auto-seed marker the
  // danger-zone reset sets so a deliberately-emptied DB is not re-seeded.
  meta: "meta",
} as const;
