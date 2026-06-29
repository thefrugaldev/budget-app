import Link from "next/link";

import { ActiveIndicator } from "@/components/shell/bottom-tab-nav/ActiveIndicator";
import { SoonBadge } from "@/components/shell/SoonBadge";
import { cn } from "@/lib/utils";
import type { NavItem } from "@/types/nav";

export function TabLink({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative flex min-h-14 flex-col items-center justify-center gap-0.5 px-1 py-2 text-[11px] leading-none transition-colors",
        active
          ? "font-semibold text-foreground"
          : "font-medium text-muted-foreground hover:text-foreground",
      )}
    >
      <ActiveIndicator active={active} />
      <span aria-hidden="true" className="text-lg leading-none">
        {item.icon}
      </span>
      <span>{item.label}</span>
      {item.placeholder && <SoonBadge className="px-1 py-0 text-[9px]" />}
    </Link>
  );
}
