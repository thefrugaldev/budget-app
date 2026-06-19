import type { CategoryKind } from "@/types/budget";

/**
 * Human-readable label for what a category's monthly target represents.
 * Used in card sub-labels and detail-page headers.
 */
export function targetLabel(kind: CategoryKind): "Cap" | "Goal" | "Baseline" {
  switch (kind) {
    case "expense":
      return "Cap";
    case "savings":
      return "Goal";
    case "income":
      return "Baseline";
  }
}

/**
 * Vocabulary for the kind-aware sign-flip segmented control on the transaction
 * form. `positive` is the action a positive-amount transaction represents;
 * `negative` is the reversal. The two-way mapping keeps the form's mental
 * model honest regardless of which kind is selected (story 35).
 */
export type SignLabels = { positive: string; negative: string };
export function signLabelsFor(kind: CategoryKind): SignLabels {
  switch (kind) {
    case "expense":
      return { positive: "Spent", negative: "Refunded" };
    case "savings":
      return { positive: "Deposit", negative: "Withdraw" };
    case "income":
      return { positive: "Received", negative: "Reversed" };
  }
}
