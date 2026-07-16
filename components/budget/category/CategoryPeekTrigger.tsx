"use client";

import { ScrollText } from "lucide-react";

/**
 * Per-row "recent activity" control on the Categories ledger. It ships in
 * #166 chunk 3 as a distinct affordance — a sibling to the row's detail link,
 * not nested inside it (story 9) — so the row layout is final. Chunk 4 wires
 * this trigger to the peek surface (a dialog on desktop / bottom sheet on
 * mobile showing the category's last ~12 transactions). It's a read affordance,
 * so it's shown to viewers too (story 28) and carries no edit capability.
 */
export function CategoryPeekTrigger({ categoryName }: { categoryName: string }) {
  return (
    <button
      type="button"
      aria-label={`Recent activity in ${categoryName}`}
      className="inline-flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <ScrollText className="size-4" aria-hidden />
    </button>
  );
}
