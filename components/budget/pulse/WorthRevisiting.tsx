"use client";

import Link from "next/link";

import { SuggestionCard } from "@/components/budget/pulse/SuggestionCard";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { useCanEdit } from "@/hooks/useCanEdit";
import type { TargetSuggestionView } from "@/types/target-suggestion";

/**
 * The low-key "Worth revisiting" module at the bottom of Pulse (#186): the few
 * highest-impact Target suggestions, each a one-tap accept/snooze/adjust. It is
 * simply **absent** when there's nothing to suggest (story 12) — no empty-state
 * box — and shows at most three, with a pointer to the rest in Categories
 * (story 13).
 *
 * A pure edit affordance: hidden wholesale from viewers via `useCanEdit()`
 * (story 20). Hiding is UX only — the accept/dismiss actions enforce
 * `requireRole("editor")` server-side.
 */
export function WorthRevisiting({
  views,
  hiddenCount,
  now,
}: {
  views: TargetSuggestionView[];
  hiddenCount: number;
  now: Date;
}) {
  const canEdit = useCanEdit();
  if (!canEdit || views.length === 0) return null;

  return (
    <section className="mt-10">
      <SectionHeading>Worth revisiting</SectionHeading>
      <ul className="space-y-2">
        {views.map((view) => (
          <SuggestionCard key={view.suggestion.categoryId} view={view} now={now} />
        ))}
      </ul>
      {hiddenCount > 0 && (
        <Link
          href="/categories"
          className="mt-3 inline-block px-1 text-xs font-medium text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          +{hiddenCount} more in Categories →
        </Link>
      )}
    </section>
  );
}
