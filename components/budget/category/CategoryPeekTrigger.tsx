"use client";

import { ScrollText } from "lucide-react";
import { useState } from "react";

import { CategoryPeekDialog } from "@/components/budget/category/CategoryPeekDialog";
import type { Category, Transaction } from "@/types/budget";

/**
 * Per-row "recent activity" control on the Categories ledger (issue #166). It's
 * a distinct affordance — a **sibling** to the row's detail link, not nested
 * inside it (story 9) — so opening the peek and opening the detail page are
 * unambiguous and each is independently keyboard reachable. Chunk 4 wires it to
 * the peek surface: a dialog on desktop / bottom sheet on mobile showing the
 * category's most recent transactions in place (stories 7, 8). It's a read
 * affordance, so it's shown to viewers too (story 28) and carries no edit
 * capability (the peek surface is read-only for everyone).
 */
export function CategoryPeekTrigger({
  category,
  transactions,
  now,
}: {
  category: Category;
  /** The category's most-recent transactions, newest first (peek-capped). */
  transactions: Transaction[];
  now: Date;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Recent activity in ${category.name}`}
        className="inline-flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ScrollText className="size-4" aria-hidden />
      </button>
      <CategoryPeekDialog
        open={open}
        onOpenChange={setOpen}
        category={category}
        transactions={transactions}
        now={now}
      />
    </>
  );
}
