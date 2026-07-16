"use client";

import { format, isValid, parseISO } from "date-fns";
import { useMemo } from "react";

import { TransactionList } from "@/components/budget/transaction/TransactionList";
import { useTransactionFilterParams } from "@/hooks/useTransactionFilterParams";
import { useDateScope } from "@/hooks/useDateScope";
import { presetForDateBounds, rangeLabel } from "@/lib/budget";
import type { Category, Transaction } from "@/types/budget";

function fmtDay(iso: string): string {
  const d = parseISO(iso);
  return isValid(d) ? format(d, "MMM d, yyyy") : iso;
}

/**
 * Human label for the active date scope, shown in the list header. Presets read
 * back by name; an empty scope is the this-month default; anything else is its
 * formatted day range.
 */
function scopeLabel(raw: { from: string; to: string }, now: Date): string {
  if (!raw.from && !raw.to) return "This month";
  const preset = presetForDateBounds(raw.from, raw.to, now);
  if (preset) return rangeLabel(preset);
  if (raw.from && raw.to) return `${fmtDay(raw.from)} – ${fmtDay(raw.to)}`;
  return raw.from ? `Since ${fmtDay(raw.from)}` : `Through ${fmtDay(raw.to)}`;
}

/**
 * URL-bound wrapper for the global `/transactions` list (story 8 of #79). Keeps
 * the server page a server component: it owns the data fetch, this boundary
 * owns all client state. The row-attribute filter binds to the URL via
 * `useTransactionFilterParams`; the date **scope** is a separate axis owned by
 * `useDateScope` (issue #165 chunk 5) that windows the full set locally — so
 * scope changes never re-run the server, and the preset chips and a custom
 * range can't intersect to empty. `transactions` is the full set; the scoped
 * slice feeds the list while the full set still backs the edit form's history.
 */
export function UrlFilteredTransactionList({
  categories,
  transactions,
  now,
}: {
  categories: Category[];
  transactions: Transaction[];
  now: Date;
}) {
  const [filter, setFilter] = useTransactionFilterParams();
  const { raw, bounds } = useDateScope(now);

  const scoped = useMemo(
    () =>
      transactions.filter(
        (t) =>
          (!bounds.from || t.date >= bounds.from) && (!bounds.to || t.date <= bounds.to),
      ),
    [transactions, bounds],
  );

  return (
    <TransactionList
      categories={categories}
      transactions={scoped}
      allTransactions={transactions}
      rangeText={scopeLabel(raw, now)}
      now={now}
      filter={filter}
      onFilterChange={setFilter}
    />
  );
}
