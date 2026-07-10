"use client";

import { Plus } from "lucide-react";
import { useState } from "react";

import { AddAccountDialog } from "@/components/net-worth/AddAccountDialog";
import { useCanEdit } from "@/hooks/useCanEdit";
import { cn } from "@/lib/utils";

/**
 * The "Add account" trigger (#109 chunk 7, story 3). Hidden for viewers — a pure
 * edit affordance, so it returns null rather than rendering a control that would
 * 403 (`useCanEdit`, the client half of the auth boundary; the server action is
 * the real gate). Two looks: `header` (compact, beside the hero) and `cta`
 * (prominent, in the empty state).
 */
export function AddAccountButton({ variant = "header" }: { variant?: "header" | "cta" }) {
  const canEdit = useCanEdit();
  const [open, setOpen] = useState(false);
  if (!canEdit) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          variant === "cta"
            ? "bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/80"
            : "px-3 py-1.5 text-sm text-muted-foreground ring-1 ring-border hover:bg-muted hover:text-foreground",
        )}
      >
        <Plus className="size-4" aria-hidden />
        Add account
      </button>
      <AddAccountDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
