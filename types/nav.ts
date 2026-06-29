/**
 * Primary-navigation types. The canonical `NAV_ITEMS` list and the active-route
 * logic live in `@/lib/nav`; the list is checked against `NavItem` via
 * `satisfies`.
 */

export type MobileTab = "primary" | "more";

export type NavItem = {
  label: string;
  href: string;
  icon: string;
  mobileTab: MobileTab;
};
