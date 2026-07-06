import type {
  AuthzDecision,
  DenyReason,
  Member,
  ResolvedSession,
  Role,
  User,
} from "@/types/auth";

/**
 * Privilege ordering. A guard requiring role R is satisfied by any role whose
 * rank is >= R's, so `owner` clears every gate and `viewer` only the read ones.
 */
const RANK: Record<Role, number> = {
  viewer: 0,
  editor: 1,
  owner: 2,
};

/** True when `role` meets or exceeds the `required` role in the privilege order. */
export function roleSatisfies(role: Role, required: Role): boolean {
  return RANK[role] >= RANK[required];
}

/**
 * The authorization core (story 13): given the session's user, their resolved
 * membership, and the role an action requires, decide allow/deny. Hiding a
 * button is never the boundary — every mutation calls this server-side.
 *
 * Deny order is meaningful (no session → missing membership → insufficient
 * role) so callers can map `no-session` to a sign-in redirect and the rest to
 * the private-app / 403 path. A membership whose `userId` doesn't match the
 * user is treated as absent (`no-membership`), never trusted.
 */
export function authorize(
  user: User | null,
  membership: Member | null,
  required: Role,
): AuthzDecision {
  if (!user) return { allowed: false, reason: "no-session" };
  if (!membership || membership.userId !== user.id) {
    return { allowed: false, reason: "no-membership" };
  }
  if (!roleSatisfies(membership.role, required)) {
    return { allowed: false, reason: "insufficient-role" };
  }
  return { allowed: true };
}

/**
 * Authorize the *resolved session* against a required role (#111 chunk 5) — the
 * adapter `authorizeCurrent` wraps around `getSession()`. Kept pure (takes the
 * session, doesn't fetch it) so the mapping is unit-testable without Clerk.
 *
 * Mapping on session status is deliberate: a `denied` session (authenticated
 * but no membership — access removed, or uninvited) maps to `no-membership`,
 * NOT `no-session`. Otherwise an action guard would read "no session" for a
 * signed-in person and bounce them to sign-in → straight back to denied → loop.
 * Only a genuinely `signed-out` request is `no-session` (a real sign-in fixes
 * it); `active` defers to the role check.
 */
export function authorizeSession(
  session: ResolvedSession,
  required: Role,
): AuthzDecision {
  switch (session.status) {
    case "signed-out":
      return { allowed: false, reason: "no-session" };
    case "denied":
      return { allowed: false, reason: "no-membership" };
    case "active":
      return authorize(session.user, session.membership, required);
  }
}

/**
 * User-facing copy for a denial, surfaced by mutating actions when their guard
 * rejects (story 13 — the boundary is server-side, but the person still gets a
 * clear reason). Intentional, safe-to-show strings — never a raw internal error.
 */
const DENIAL_MESSAGES: Record<DenyReason, string> = {
  "no-session": "Your session has expired. Please sign in again.",
  "no-membership": "You don't have access to this household.",
  "insufficient-role": "You don't have permission to make that change.",
};

export function denialMessage(reason: DenyReason): string {
  return DENIAL_MESSAGES[reason];
}
