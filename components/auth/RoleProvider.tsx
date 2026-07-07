"use client";

import { RoleContext } from "@/hooks/roleContext";
import type { Role } from "@/types/auth";

/**
 * Carries the active member's role to client components (#111 chunk 7) so edit
 * affordances can be *hidden* below the required role (story 9 — absent, not
 * disabled). Seeded once by the authenticated layout from the server-resolved
 * session; consumed via `useCanEdit`. This is a UI convenience only — never the
 * security boundary: every mutation is still gated server-side by `requireRole`.
 */
export function RoleProvider({
  role,
  children,
}: {
  role: Role;
  children: React.ReactNode;
}) {
  return <RoleContext.Provider value={role}>{children}</RoleContext.Provider>;
}
