/**
 * Public API of the pure authorization core (#111 chunk 1). The Clerk boundary
 * (`getCurrentUser`, SDK-backed guards) joins this module in chunk 3; these
 * exports are Clerk-agnostic and safe to import anywhere. Types live in
 * `@/types/auth` — import them from there, not through this barrel.
 */
export { authorize, roleSatisfies } from "./authorize";
export { matchInvite, normalizeEmail } from "./invite";
export { decideSignIn } from "./sign-in";
export { planBackfill } from "./backfill";
