"use client";

import { Plus } from "lucide-react";
import { useState } from "react";

import { AddCategoryDialog } from "@/components/budget/AddCategoryDialog";
import { cn } from "@/lib/utils";
import type { CategoryKind } from "@/types/budget";

/**
 * Card-shaped "Add" tile rendered at the end of each section's card grid on
 * the Pulse overview (story 13/58). Kind is preset by the section it lives in,
 * so the dialog's kind picker collapses to a single chip inside the form.
 */
export function AddCategoryTile({ kind }: { kind: CategoryKind }) {
  const [open, setOpen] = useState(false);
  const label =
    kind === "expense"
      ? "Add expense category"
      : kind === "savings"
        ? "Add savings category"
        : "Add income source";
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "group flex min-h-[140px] cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border bg-transparent p-5 text-muted-foreground transition-colors",
          "hover:border-foreground/30 hover:bg-card hover:text-foreground",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        )}
      >
        <span
          aria-hidden
          className="grid size-10 place-items-center rounded-full bg-muted text-muted-foreground group-hover:text-foreground"
        >
          <Plus className="size-5" />
        </span>
        <span className="text-sm font-medium">{label}</span>
      </button>
      <AddCategoryDialog
        open={open}
        onOpenChange={setOpen}
        presetKind={kind}
      />
    </>
  );
}
