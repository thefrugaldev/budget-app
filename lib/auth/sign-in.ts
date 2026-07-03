import type { Invite, Member, SignInOutcome } from "@/types/auth";

import { matchInvite } from "./invite";

/**
 * Decide what happens when a user authenticates (ADR 0004: bootstrap → enter →
 * join → deny). This is the deny-by-default gate above the auth library, kept
 * pure so the branch table is exhaustively testable without Clerk or Mongo.
 *
 * Precedence:
 * 1. No household exists anywhere → bootstrap (the very first sign-in ever).
 * 2. The user already has a membership → enter with its role (already-member).
 * 3. A pending invite matches the verified email → join with the invite's role.
 * 4. Otherwise → deny (authenticated but uninvited; no residue is created).
 *
 * `membership` is the caller-resolved membership for *this* user, so a present
 * value is theirs by construction.
 */
export function decideSignIn(input: {
  /** The provider-verified email of the authenticating user. */
  email: string;
  /** Whether any household exists at all — false only before the first sign-in. */
  householdExists: boolean;
  /** This user's existing membership, if they already belong to the household. */
  membership: Member | null;
  /** All invites to consider; `matchInvite` filters to pending + email match. */
  invites: readonly Invite[];
}): SignInOutcome {
  const { email, householdExists, membership, invites } = input;

  if (!householdExists) return { kind: "bootstrap" };
  if (membership) return { kind: "enter", role: membership.role };

  const invite = matchInvite(email, invites);
  if (invite) return { kind: "join", invite };

  return { kind: "deny" };
}
