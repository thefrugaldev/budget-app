import { createElement } from "react";
import { Home, Landmark, TrendingUp, Wallet, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import type { Account } from "@/types/net-worth";

/**
 * The palette-tinted Lucide icon for an account, in the same rounded tile as
 * `CategoryIcon` so Net Worth reads as the same product (#109 chunk 6, story
 * 20). The set is small and fixed (four account types), so icons are imported
 * statically rather than through the category catalogue's lazy path. Decorative
 * — the account name always sits alongside — so it's `aria-hidden`.
 */
const ICON_BY_KIND: Record<"cash" | "investment" | "property" | "liability", LucideIcon> = {
  cash: Wallet,
  investment: TrendingUp,
  property: Home,
  liability: Landmark,
};

/** The account's icon key: its asset kind, or `liability` (liabilities carry no kind). */
export function accountIconKind(
  account: Pick<Account, "class" | "kind">,
): "cash" | "investment" | "property" | "liability" {
  return account.class === "liability" ? "liability" : (account.kind ?? "cash");
}

export function AccountIcon({
  account,
  className,
  iconClassName,
}: {
  account: Pick<Account, "class" | "kind">;
  className?: string;
  iconClassName?: string;
}) {
  return (
    <span
      className={cn(
        "grid size-11 shrink-0 place-items-center rounded-xl bg-muted text-foreground",
        className,
      )}
    >
      {createElement(ICON_BY_KIND[accountIconKind(account)], {
        "aria-hidden": true,
        className: cn("size-5", iconClassName),
      })}
    </span>
  );
}
