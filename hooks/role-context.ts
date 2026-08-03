"use client";

import { createContext } from "react";

import type { Role } from "@/types/auth";

/**
 * The active member's role for client components (#111 chunk 7). Lives here —
 * beside its consuming `useCanEdit` hook — rather than in the `RoleProvider`
 * component so the hook doesn't depend on a component module. `RoleProvider`
 * imports it to build the provider; `useCanEdit` imports it to read the role.
 *
 * Defaults to `null` (no provider) so `useCanEdit` fails closed to read-only —
 * a UI-hiding convenience, never the security boundary (that's `requireRole`).
 */
export const RoleContext = createContext<Role | null>(null);
