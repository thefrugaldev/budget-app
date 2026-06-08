import type { Category, CategoryTarget } from "@/types/budget";
import {
  currentMonthlyBaseline,
  fmt,
  isCategoryActiveForMonth,
  resolveTargetForMonth,
} from "@/lib/budget";

import { IncomeEditDialog, type IncomeSourceRow } from "./IncomeEditDialog";

/**
 * Right-side header treatment on the Pulse page. Shows annualized total
 * income at the current month with an edit affordance — opens a modal that
 * lists each income source individually (story 8) so the user can update one
 * source without retyping the others.
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
  // Filter once; both the annualized total and the modal's per-source rows
  // operate on the same "active right now" set.
  const activeIncomeCategories = incomeCategories.filter((c) =>
    isCategoryActiveForMonth(c, currentMonth),
  );
  const totalMonthly = currentMonthlyBaseline(
    activeIncomeCategories,
    targets,
    currentMonth,
  );
  const totalYearly = totalMonthly * 12;

  const sources: IncomeSourceRow[] = activeIncomeCategories.map((c) => ({
    id: c.id,
    name: c.name,
    emoji: c.emoji,
    currentMonthly: resolveTargetForMonth(c.id, currentMonth, targets),
  }));

  return (
    <div className="flex items-start gap-3">
      <div className="text-right">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          Current total income
        </p>
        <p className="font-heading text-2xl font-semibold tabular-nums">
          {fmt(totalYearly)}
          <span className="ml-0.5 text-sm font-normal text-muted-foreground">
            /yr
          </span>
        </p>
      </div>
      <IncomeEditDialog
        sources={sources}
        currentMonth={currentMonth}
        triggerClassName="mt-1"
      />
    </div>
  );
}
