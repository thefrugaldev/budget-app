import "server-only";

import type { DenyReason, Role } from "@/types/auth";

import { denialMessage } from "./authorize";
import { authorizeCurrent } from "./session";

/**
 * Thrown by {@link requireRole} when the current session may not perform an
 * action (#111 chunk 5). Its `message` is safe-to-show denial copy (from
 * `denialMessage`), so a mutating action's existing `catch` can surface it
 * directly — a viewer who forces a write gets a clear reason, server-side, and
 * `reason` is kept for callers that want to branch (e.g. redirect on no-session).
 */
export class AuthorizationError extends Error {
  constructor(readonly reason: DenyReason) {
    super(denialMessage(reason));
    this.name = "AuthorizationError";
  }
}

/**
 * Assert the current session satisfies `required`, else throw
 * {@link AuthorizationError}. Call it as the first line of a mutating server
 * action's `try` block: the throw flows through the action's existing `catch`
 * into that action's error shape, so guarding is one uniform line per action and
 * the check runs before any parsing or data access. Reads don't call this — the
 * scoped repositories already gate them to an active member.
 */
export async function requireRole(required: Role): Promise<void> {
  const decision = await authorizeCurrent(required);
  if (!decision.allowed) {
    throw new AuthorizationError(decision.reason);
  }
}
