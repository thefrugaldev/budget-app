"use client";

import { Menu } from "@base-ui/react/menu";
import { MoreHorizontal } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { NAV_ITEMS, isActive, type NavItem } from "@/lib/nav";
import { cn } from "@/lib/utils";

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

function TabLink({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex min-h-14 flex-col items-center justify-center gap-0.5 px-1 py-2 text-[11px] font-medium leading-none transition-colors",
        active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
      )}
    >
      <span aria-hidden="true" className="text-lg leading-none">
        {item.icon}
      </span>
      <span>{item.label}</span>
    </Link>
  );
}

function MoreTab({
  overflow,
  pathname,
  active,
  open,
  onOpenChange,
}: {
  overflow: readonly NavItem[];
  pathname: string;
  active: boolean;
  open: boolean;
  onOpenChange: (next: boolean) => void;
}) {
  return (
    <Menu.Root open={open} onOpenChange={onOpenChange}>
      <Menu.Trigger
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex min-h-14 flex-col items-center justify-center gap-0.5 px-1 py-2 text-[11px] font-medium leading-none outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
          active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
        )}
      >
        <MoreHorizontal aria-hidden className="size-5" />
        <span>More</span>
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner side="top" sideOffset={8} align="end" className="z-40 outline-none">
          <Menu.Popup className="min-w-44 rounded-xl bg-card p-1 text-sm shadow-xl ring-1 ring-border outline-none">
            {overflow.map((item) => {
              const itemActive = isActive(pathname, item.href);
              return (
                <Menu.Item
                  key={item.href}
                  render={
                    <Link
                      href={item.href}
                      aria-current={itemActive ? "page" : undefined}
                    />
                  }
                  className={cn(
                    "flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 outline-none data-[highlighted]:bg-muted",
                    itemActive && "font-medium text-foreground",
                  )}
                >
                  <span aria-hidden="true">{item.icon}</span>
                  <span>{item.label}</span>
                </Menu.Item>
              );
            })}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
