import { Pencil } from "lucide-react";
import Link from "next/link";

import { currentMonthlyBaseline, fmt } from "@/lib/budget";
import type { Category, CategoryTarget } from "@/types/budget";

/**
 * Right-side header treatment on the Pulse page. Shows annualized total
 * income at the current month with a pencil affordance — a `<Link>` to the
 * dedicated `/income` page (chunk 7 of #39 retired the inline edit modal).
 *
 * Using a real link, not a `<button>`, so middle-click / Cmd-click open
 * `/income` in a new tab the same way every other nav target does
 * (story 21).
 */
export function HeaderIncome({
  incomeCategories,
  targets,
  currentMonth,
}: {
  incomeCategories: Category[];
  targets: CategoryTarget[];
  currentMonth: string;
}) {
  // `currentMonthlyBaseline` already filters to sources active *this* month,
  // so ended/future sources don't inflate the headline figure.
  const totalMonthly = currentMonthlyBaseline(
    incomeCategories,
    targets,
    currentMonth,
  );
  const totalYearly = totalMonthly * 12;

  return (
    <div className="flex items-start gap-3">
      <div className="text-right">
        {/* "Annual" disambiguates this baseline figure from the hero's
            this-month "you brought in" actual (#178 story 11) — two income
            numbers side by side otherwise read as a discrepancy. */}
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          Annual income
        </p>
        <p className="font-heading text-2xl font-semibold tabular-nums">
          {fmt(totalYearly)}
          <span className="ml-0.5 text-sm font-normal text-muted-foreground">
            /yr
          </span>
        </p>
      </div>
      <Link
        href="/income"
        aria-label="Edit income"
        className="mt-1 inline-flex size-7 items-center justify-center rounded-full text-muted-foreground ring-1 ring-border transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Pencil className="size-3.5" aria-hidden />
      </Link>
    </div>
  );
}
