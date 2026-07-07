import type { Role } from "@/types/auth";

import { ROLE_LABELS } from "./roleLabels";

/**
 * A small text pill naming a role, used in the members list and pending-invite
 * rows (#111 chunk 6). Carries the role as a word (not color alone), satisfying
 * the accessibility baseline; tinted from palette tokens only.
 */
export function RoleBadge({ role }: { role: Role }) {
  return (
    <span className="inline-flex shrink-0 items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
      {ROLE_LABELS[role]}
    </span>
  );
}
