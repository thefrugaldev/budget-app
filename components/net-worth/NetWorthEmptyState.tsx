import { Home, Landmark, TrendingUp, Wallet } from "lucide-react";
import type { ReactNode } from "react";

/**
 * First-run state for the Net Worth page (story 17): explains what an account is
 * and the four types the page tracks, so the page is self-explanatory on day
 * one. `action` is the "Add account" trigger (#109 chunk 7) — role-gated, so it's
 * absent for a viewer, who just sees the explanatory copy.
 */
const TYPES = [
  { icon: Wallet, label: "Cash", hint: "checking, savings" },
  { icon: TrendingUp, label: "Investments", hint: "brokerage, retirement" },
  { icon: Home, label: "Property", hint: "a home, a car" },
  { icon: Landmark, label: "Liabilities", hint: "a mortgage, loans" },
];

export function NetWorthEmptyState({ action }: { action?: ReactNode }) {
  return (
    <div className="mx-auto max-w-xl rounded-2xl bg-card p-8 text-center ring-1 ring-border">
      <h2 className="font-heading text-display font-semibold tracking-tight">
        Track your net worth
      </h2>
      <p className="mx-auto mt-3 max-w-md text-base text-muted-foreground">
        Add an account for each thing you own or owe. Net worth is everything
        you own minus everything you owe — updated whenever you check in.
      </p>
      <ul className="mt-6 grid grid-cols-2 gap-3 text-left">
        {TYPES.map(({ icon: Icon, label, hint }) => (
          <li key={label} className="flex items-center gap-3 rounded-xl bg-muted px-3 py-2.5">
            <Icon aria-hidden className="size-5 shrink-0 text-foreground" />
            <span className="min-w-0">
              <span className="block text-sm font-medium leading-tight">{label}</span>
              <span className="block truncate text-xs text-muted-foreground">{hint}</span>
            </span>
          </li>
        ))}
      </ul>
      {action && <div className="mt-6 flex justify-center">{action}</div>}
    </div>
  );
}
