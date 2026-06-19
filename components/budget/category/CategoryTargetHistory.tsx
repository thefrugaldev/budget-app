"use client";

import { useState } from "react";

import { targetLabel } from "@/lib/budget";
import type { CategoryKind, CategoryTarget } from "@/types/budget";

import { NewTargetRowForm } from "./NewTargetRowForm";
import { TargetRowForm } from "./TargetRowForm";

/**
 * Collapsed "View {target}-history" disclosure inside the category edit panel.
 * Sorts target rows newest-first; each row is editable in place, and an
 * "+ Insert target row" footer adds a new row at an arbitrary `effectiveFrom`.
 * The earliest row is non-removable — deleting it would leave months below
 * the surviving floor resolving to 0 (the server action enforces the same
 * rule).
 */
export function CategoryTargetHistory({
  categoryId,
  targets,
  kind,
}: {
  categoryId: string;
  /** Pre-sorted newest-first by the parent. */
  targets: CategoryTarget[];
  kind: CategoryKind;
}) {
  const [showAddRow, setShowAddRow] = useState(false);
  return (
    <details className="group">
      <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground">
        View {targetLabel(kind).toLowerCase()} history
        <span className="ml-1 font-normal normal-case text-muted-foreground">
          ({targets.length} row{targets.length === 1 ? "" : "s"})
        </span>
      </summary>
      <div className="mt-3 space-y-2">
        {targets.map((row, idx) => (
          <TargetRowForm
            key={`${row.categoryId}:${row.effectiveFrom}`}
            row={row}
            // `targets` is newest-first; last item is earliest. Removing the
            // earliest would leave months below it with a 0 target.
            canDelete={targets.length > 1 && idx !== targets.length - 1}
          />
        ))}
        {showAddRow ? (
          <NewTargetRowForm
            categoryId={categoryId}
            onDone={() => setShowAddRow(false)}
            onCancel={() => setShowAddRow(false)}
          />
        ) : (
          <button
            type="button"
            onClick={() => setShowAddRow(true)}
            className="w-full rounded-md border border-dashed border-border px-2 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            + Insert target row
          </button>
        )}
      </div>
    </details>
  );
}
