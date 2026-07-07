/**
 * Auth domain vocabulary (CONTEXT.md: Household, User, Member, Invite) and the
 * result shapes of the pure authorization core in `@/lib/auth`. These are the
 * *domain* types, Clerk-agnostic by design (ADR 0004's anti-lock-in seam):
 * documents never carry Clerk ids and this file never imports the SDK. The
 * Mongo persistence shapes (`*Document`) arrive with the data layer in #111
 * chunk 2; the pure logic and its callers reason over these.
 */

/**
 * A member's role within a household, ordered by privilege:
 * `viewer` < `editor` < `owner`. A guard requiring role R is satisfied by any
 * role at or above R (see `roleSatisfies`).
 */
export type Role = "owner" | "editor" | "viewer";

/**
 * The roles an Invite may grant. `owner` is bootstrap-only — exactly one per
 * household, transfer out of scope (ADR 0004) — so it is never invitable.
 */
export type InvitableRole = Exclude<Role, "owner">;

/**
 * Link from our User to the external identity provider. At v1 the only provider
 * is Clerk and `subjectId` is Clerk's user id. Kept as a nested link (not flat
 * fields on User) so a future provider swap relinks here without reshaping the
 * entity — the migration story in ADR 0004.
 */
export type AuthProviderLink = {
  provider: "clerk";
  subjectId: string;
};

/**
 * An authenticated person (CONTEXT.md: User) in *our* terms — never a Clerk
 * shape. `id` is our stable id, `email` the provider-verified email (matched
 * against invites), `provider` the link back to the external identity.
 */
export type User = {
  id: string;
  email: string;
  provider: AuthProviderLink;
};

/** The unit of data ownership (CONTEXT.md: Household). */
export type Household = {
  id: string;
};

/** A user's role-bearing association with a household (CONTEXT.md: Member). */
export type Member = {
  userId: string;
  householdId: string;
  role: Role;
};

/**
 * A member joined to their user's verified email — the shape the owner's
 * Members list renders (#111 chunk 6). Composed in the Settings loader from
 * `listMembersByHousehold` + `listUsersByIds`; the email is display-only (role
 * changes and removal key off `userId`, never the email).
 */
export type MemberWithEmail = Member & { email: string };

/** Lifecycle of an Invite: `pending` until a matching sign-in consumes it. */
export type InviteStatus = "pending" | "accepted";

/**
 * A pending, owner-created grant (CONTEXT.md: Invite): an email + role matched
 * against a verified OAuth email on sign-in. No email is ever sent.
 */
export type Invite = {
  id: string;
  householdId: string;
  /** Target email; compare via `normalizeEmail` — not guaranteed pre-normalized. */
  email: string;
  role: InvitableRole;
  status: InviteStatus;
};

/**
 * Why an authorization check denied, carried so callers can branch: map
 * `no-session` to a sign-in redirect, the rest to the private-app / 403 path.
 */
export type DenyReason = "no-session" | "no-membership" | "insufficient-role";

/** Result of a role guard: allow, or deny with a machine-readable reason. */
export type AuthzDecision =
  | { allowed: true }
  | { allowed: false; reason: DenyReason };

/**
 * What should happen for an authenticating user, decided by `decideSignIn`:
 * - `bootstrap`: no household exists yet — create it, this user becomes owner,
 *   backfill pre-auth data (the very first sign-in ever).
 * - `enter`: the user already has a membership — enter with that role.
 * - `join`: a pending invite matched the verified email — create a membership
 *   with the invite's role and consume the invite.
 * - `deny`: authenticated but uninvited — the private-app screen, no residue.
 */
export type SignInOutcome =
  | { kind: "bootstrap" }
  | { kind: "enter"; role: Role }
  | { kind: "join"; invite: Invite }
  | { kind: "deny" };

/**
 * The minimum shape backfill planning reads from a pre-auth document: its id and
 * whether it already carries a `householdId`. Repositories pass their documents
 * structurally — planning never needs the full document.
 */
export type BackfillableDoc = {
  id: string;
  householdId?: string;
};

/**
 * The outcome of resolving the current request's session at the auth boundary
 * (`@/lib/auth/session`): signed out, authenticated-but-uninvited (the
 * private-app screen), or an active member carrying their user + membership.
 * Consumed by the authenticated layout and (chunk 5) the action guards.
 */
export type ResolvedSession =
  | { status: "signed-out" }
  | { status: "denied" }
  | { status: "active"; user: User; membership: Member };

/**
 * Which documents, grouped by collection, need `householdId` stamped during the
 * bootstrap backfill. Produced by `planBackfill`; the write is a thin repo call.
 */
export type BackfillPlan = {
  householdId: string;
  /** Collection name → ids missing a householdId (already-stamped docs omitted). */
  byCollection: Record<string, string[]>;
  /** Total ids to stamp across all collections — 0 means nothing to do. */
  total: number;
};
