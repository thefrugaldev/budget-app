"use client";

import { useContext } from "react";

import { roleSatisfies } from "@/lib/auth";

import { RoleContext } from "./roleContext";

/**
 * Whether the current member may mutate data — true for `editor` and `owner`,
 * false for `viewer` (#111 chunk 7). Client components use it to hide edit
 * affordances (add flows, row menus, inline editors). Hiding is never the
 * boundary: the same actions are enforced server-side by `requireRole`, so a
 * missing provider (null role) fails closed to read-only.
 */
export function useCanEdit(): boolean {
  const role = useContext(RoleContext);
  return role != null && roleSatisfies(role, "editor");
}
