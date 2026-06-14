"use client";

import { Plus } from "lucide-react";
import { useState } from "react";

import { AddIncomeSourceDialog } from "@/components/budget/AddIncomeSourceDialog";
import { cn } from "@/lib/utils";

/**
 * Button-plus-dialog wrapper for the `/income` page's "+ Add income source"
 * action. The button is rendered inline at the top of the page so creating a
 * new source is one click without scrolling (story 13). The dialog itself is
 * the same shape the floating ⊕ menu uses (story 14).
 *
 * Two visual variants:
 * - `default` — pill button used in the page header.
 * - `prominent` — larger CTA used by the empty-state card.
 */
export function AddIncomeSourceLauncher({
  variant = "default",
  className,
}: {
  variant?: "default" | "prominent";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const styles =
    variant === "prominent"
      ? "inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      : "inline-flex items-center gap-1.5 rounded-full bg-card px-3.5 py-1.5 text-sm font-medium text-foreground ring-1 ring-border hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={cn(styles, className)}>
        <Plus className="size-4" aria-hidden />
        <span>Add income source</span>
      </button>
      <AddIncomeSourceDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
