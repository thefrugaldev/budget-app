import "server-only";

import { cache } from "react";

import { runBackfill } from "@/lib/db/backfill";
import { isDuplicateKeyError } from "@/lib/db/errors";
import { createHousehold, getHousehold } from "@/lib/repositories/households";
import { consumeInvite, listInvitesByHousehold } from "@/lib/repositories/invites";
import { createMember, findMemberByUserId } from "@/lib/repositories/members";
import { createUser, findUserByProviderSubject } from "@/lib/repositories/users";
import type { AuthzDecision, ResolvedSession, Role } from "@/types/auth";

import { authorizeSession } from "./authorize";
import { getClerkSubjectId, getClerkVerifiedEmail } from "./clerk";
import { decideSignIn } from "./sign-in";

/**
 * Resolve the current request's session to *our* shapes — the real gate that
 * every loader/action trusts (the proxy redirect is only optimistic). Wrapped
 * in React `cache()` so the layout, pages, and actions share one resolution —
 * and one lazy bootstrap — per request rather than re-hitting Clerk + Mongo.
 *
 * A returning member resolves by subject id (no Clerk API call). A never-seen
 * authenticated person runs the first-sign-in decision (ADR 0004): bootstrap
 * the household, join via a matching invite, or land on the private-app screen
 * with no residue created.
 */
export const getSession = cache(async (): Promise<ResolvedSession> => {
  const subjectId = await getClerkSubjectId();
  if (!subjectId) return { status: "signed-out" };

  const existing = await findUserByProviderSubject(subjectId);
  if (existing) {
    const membership = await findMemberByUserId(existing.id);
    // A user record without a membership means their access was removed — deny
    // rather than trust a dangling identity.
    if (!membership) return { status: "denied" };
    return { status: "active", user: existing, membership };
  }

  return firstSignIn(subjectId);
});

async function firstSignIn(subjectId: string): Promise<ResolvedSession> {
  const email = await getClerkVerifiedEmail();
  // No verified email means we can neither match an invite nor own a household.
  if (!email) return { status: "denied" };

  const household = await getHousehold();
  const invites = household ? await listInvitesByHousehold(household.id) : [];
  const outcome = decideSignIn({
    email,
    householdExists: household != null,
    membership: null,
    invites,
  });

  try {
    switch (outcome.kind) {
      case "deny":
        // Deny by default: no user record is created for an uninvited sign-in.
        return { status: "denied" };
      case "bootstrap": {
        const user = await createUser({ email, providerSubjectId: subjectId });
        const created = await createHousehold();
        const membership = await createMember({
          householdId: created.id,
          userId: user.id,
          role: "owner",
        });
        // Adopt all pre-auth documents into the new household (story 3).
        await runBackfill(created.id);
        return { status: "active", user, membership };
      }
      case "join": {
        const user = await createUser({ email, providerSubjectId: subjectId });
        const membership = await createMember({
          householdId: outcome.invite.householdId,
          userId: user.id,
          role: outcome.invite.role,
        });
        await consumeInvite(outcome.invite.id);
        return { status: "active", user, membership };
      }
      case "enter":
        // Unreachable: `enter` requires an existing membership, handled by the
        // returning-member branch in getSession before we ever get here.
        return { status: "denied" };
    }
  } catch (err) {
    // A concurrent first sign-in for the same person (two tabs, an SSR retry)
    // can lose the race on the unique providerSubjectId/userId indexes. Adopt
    // the records the winner created rather than surfacing a duplicate-key 500.
    // (The narrower two-different-users double-bootstrap is a v1 edge — the
    // owner is a single known person; a households singleton index can harden
    // it later if it ever bites.)
    if (!isDuplicateKeyError(err)) throw err;
    const user = await findUserByProviderSubject(subjectId);
    const membership = user ? await findMemberByUserId(user.id) : null;
    if (user && membership) return { status: "active", user, membership };
    return { status: "denied" };
  }
}

/** The current user for an active session, else null. */
export async function getCurrentUser() {
  const session = await getSession();
  return session.status === "active" ? session.user : null;
}

/**
 * The household the current request is allowed to touch (#111 chunk 4). Every
 * household-owned repository read filters by this and every write stamps it, so
 * the tenancy boundary lives in the data layer — verified on every read and
 * write, not merely at the proxy/layout redirect (story 14). Resolved from the
 * once-per-request cached `getSession`, so calling it from many repositories in
 * one request costs a single resolution.
 *
 * Throws for any non-active session: a forged or expired cookie fails Clerk
 * verification inside `getSession` (→ signed-out) or resolves to a membership-
 * less identity (→ denied), and either way reaches no data. Callers that reach a
 * repository have already passed the layout gate on page loads; for Server
 * Functions (which the proxy only optimistically guards) this is the real
 * server-side check. Role enforcement layers on top in chunk 5.
 */
export async function requireHouseholdId(): Promise<string> {
  const session = await getSession();
  if (session.status !== "active") {
    throw new Error("No active household session");
  }
  return session.membership.householdId;
}

/**
 * Server-side role guard for actions and loaders: the authorization decision for
 * the current session against a required role. Hiding a button is never the
 * boundary — mutations call this (via `requireRole`). The status→decision
 * mapping (incl. denied→no-membership) lives in the pure `authorizeSession`.
 */
export async function authorizeCurrent(required: Role): Promise<AuthzDecision> {
  return authorizeSession(await getSession(), required);
}
