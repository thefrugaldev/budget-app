"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { MoreTab } from "@/components/shell/bottom-tab-nav/MoreTab";
import { TabLink } from "@/components/shell/bottom-tab-nav/TabLink";
import { NAV_ITEMS, isActive } from "@/lib/nav";

export function BottomTabNav() {
  const pathname = usePathname();
  const primary = NAV_ITEMS.filter((i) => i.mobileTab === "primary");
  const overflow = NAV_ITEMS.filter((i) => i.mobileTab === "more");
  const moreActive = overflow.some((i) => isActive(pathname, i.href));

  // Story 17: if the user opens the "More" popover on mobile and then resizes
  // past the `md` breakpoint, the bottom nav's trigger gets `display: none` —
  // but the popover is portaled to <body>, so it would linger as a stale UI
  // element on the desktop view. Close it explicitly on the transition.
  const [moreOpen, setMoreOpen] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const onChange = (e: MediaQueryListEvent) => {
      if (e.matches) setMoreOpen(false);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-30 flex border-t border-border bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/75 md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="grid w-full grid-cols-5">
        {primary.map((item) => (
          <li key={item.href} className="contents">
            <TabLink item={item} active={isActive(pathname, item.href)} />
          </li>
        ))}
        <li className="contents">
          <MoreTab
            overflow={overflow}
            pathname={pathname}
            active={moreActive}
            open={moreOpen}
            onOpenChange={setMoreOpen}
          />
        </li>
      </ul>
    </nav>
  );
}
