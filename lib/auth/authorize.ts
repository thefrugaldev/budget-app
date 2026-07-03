import type { AuthzDecision, Member, Role, User } from "@/types/auth";

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
