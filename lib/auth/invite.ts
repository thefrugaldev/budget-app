import type { Invite } from "@/types/auth";

/**
 * Canonicalize an email for invite matching: trim surrounding whitespace and
 * lowercase. Deliberately conservative — no gmail dot/plus folding, which could
 * match the wrong person; the verified OAuth email and the owner-typed invite
 * email need only agree case-insensitively.
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * The pending invite whose email matches `email` (case- and space-insensitive),
 * or undefined if none. Only `pending` invites match — an already-consumed
 * (`accepted`) invite never re-grants access (the "consumed-invite" case). If
 * several pending invites somehow share an email the first wins; the owner UI
 * (chunk 6) prevents duplicates upstream.
 */
export function matchInvite(
  email: string,
  invites: readonly Invite[],
): Invite | undefined {
  const target = normalizeEmail(email);
  return invites.find(
    (invite) =>
      invite.status === "pending" && normalizeEmail(invite.email) === target,
  );
}
