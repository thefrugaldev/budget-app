"use client";

import { Menu } from "@base-ui/react/menu";
import { MoreHorizontal } from "lucide-react";
import Link from "next/link";

import { ActiveIndicator } from "@/components/shell/bottom-tab-nav/ActiveIndicator";
import { isActive, type NavItem } from "@/lib/nav";
import { cn } from "@/lib/utils";

export function MoreTab({
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
          "relative flex min-h-14 flex-col items-center justify-center gap-0.5 px-1 py-2 text-[11px] leading-none outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
          active
            ? "font-semibold text-foreground"
            : "font-medium text-muted-foreground hover:text-foreground",
        )}
      >
        <ActiveIndicator active={active} />
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
