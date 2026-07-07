import { normalizeEmail } from "@/lib/auth";
import type { InvitableRole } from "@/types/auth";

/**
 * Parsers for the owner's Members & Invites actions (#111 chunk 6), mirroring
 * the category/income/transaction parser pattern: each validates one FormData
 * field and throws a user-facing message the action surfaces inline. Kept pure
 * (no DB, no session) so they unit-test without a server context.
 */

// Deliberately permissive shape check: exactly one `@`, non-empty local and
// domain parts, and a dotted domain. We're not RFC-validating — the real proof
// an address is reachable/owned is the verified OAuth email that must later
// match this invite; this only catches obvious typos before we persist.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * The invitee's email, normalized (trimmed + lowercased) so it stores in the
 * same canonical form `matchInvite` compares against and the pending-invite
 * unique index dedupes on. Throws on empty or malformed input.
 */
export function parseInviteEmail(raw: FormDataEntryValue | null): string {
  if (typeof raw !== "string" || raw.trim() === "") {
    throw new Error("Email is required");
  }
  const normalized = normalizeEmail(raw);
  if (!EMAIL_RE.test(normalized)) {
    throw new Error("Enter a valid email address");
  }
  return normalized;
}

/**
 * The role an invite grants or a member is changed to. Only `editor`/`viewer`
 * are accepted — `owner` is bootstrap-only and never invitable or assignable
 * (ADR 0004), so the type itself (`InvitableRole`) makes owner unrepresentable.
 */
export function parseInvitableRole(
  raw: FormDataEntryValue | null,
): InvitableRole {
  if (raw === "editor" || raw === "viewer") return raw;
  throw new Error("Choose a role: editor or viewer");
}

/** Our stable user id identifying the member a role change / removal targets. */
export function parseUserId(raw: FormDataEntryValue | null): string {
  if (typeof raw !== "string" || raw.trim() === "") {
    throw new Error("userId is required");
  }
  return raw.trim();
}

/** The invite id a revoke targets. */
export function parseInviteId(raw: FormDataEntryValue | null): string {
  if (typeof raw !== "string" || raw.trim() === "") {
    throw new Error("inviteId is required");
  }
  return raw.trim();
}
