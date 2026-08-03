"use client";

import { CategoryIcon } from "@/components/budget/category/CategoryIcon";
import { Sparkline } from "@/components/budget/category/Sparkline";
import { SuggestionActions } from "@/components/budget/suggestion/SuggestionActions";
import { SuggestionEvidence } from "@/components/budget/suggestion/SuggestionEvidence";
import type { TargetSuggestionView } from "@/types/target-suggestion";

/**
 * One "Worth revisiting" row (#186): the evidence for a single Target
 * suggestion and its three one-tap actions, in a card container. The evidence
 * sentence, before→after, and the Accept / Not now / Adjust… affordances are
 * shared with the category-detail chart caption via `SuggestionEvidence` +
 * `SuggestionActions`; only the container differs (card here; the chart is the
 * evidence on the detail page).
 *
 * Rendered only inside `WorthRevisiting`, which is hidden wholesale from
 * viewers via `useCanEdit()`; the server actions enforce `requireRole("editor")`
 * regardless, so this stays a pure edit affordance.
 */
export function SuggestionCard({
  view,
  now,
}: {
  view: TargetSuggestionView;
  now: Date;
}) {
  const { category, series } = view;

  return (
    <li className="rounded-xl bg-card p-4 ring-1 ring-border">
      <div className="flex items-start gap-3">
        <CategoryIcon category={category} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <p className="truncate font-medium">{category.name}</p>
            <Sparkline totals={series} className="mt-0.5 shrink-0" />
          </div>
          <div className="mt-1">
            <SuggestionEvidence suggestion={view.suggestion} category={category} />
          </div>
        </div>
      </div>

      <div className="mt-3">
        <SuggestionActions view={view} now={now} />
      </div>
    </li>
  );
}
