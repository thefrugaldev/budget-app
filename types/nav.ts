/**
 * Primary-navigation types. The canonical `NAV_ITEMS` list and the active-route
 * logic live in `@/lib/nav`; the list is annotated `readonly NavItem[]`.
 */

import type { LucideIcon } from "lucide-react";

export type MobileTab = "primary" | "more";

export type NavItem = {
  label: string;
  href: string;
  /** Palette-tintable lucide icon (#80 chunk 4) — replaced the emoji glyph. */
  icon: LucideIcon;
  mobileTab: MobileTab;
  /**
   * A destination that isn't built yet (lands on a "Coming soon" page). The
   * nav surfaces these with a "Soon" marker so they read as upcoming rather
   * than as live peers to the real features.
   */
  placeholder?: boolean;
};
