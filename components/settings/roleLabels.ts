import type { InvitableRole, Role } from "@/types/auth";

/**
 * Human labels for the three roles, shared by the Members & Invites surfaces
 * (#111 chunk 6): the role badge, the invite form's role select, and the
 * per-member role select. A small presentation constant bound to the settings
 * module — the sanctioned co-located exception in AGENTS.md.
 */
export const ROLE_LABELS: Record<Role, string> = {
  owner: "Owner",
  editor: "Editor",
  viewer: "Viewer",
};

/**
 * The roles an owner may grant — the option set for both selects. `owner` is
 * bootstrap-only and never invitable/assignable (ADR 0004), so it's absent by
 * the `InvitableRole` type, not by a runtime filter.
 */
export const INVITABLE_ROLES: readonly InvitableRole[] = ["editor", "viewer"];
