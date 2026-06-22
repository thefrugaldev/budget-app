import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import type { Category, CategoryKind } from "@/types/budget";

const KIND_LABEL: Record<CategoryKind, string> = {
  expense: "expense",
  savings: "savings",
  income: "income",
};

/**
 * Guards a recategorise that crosses category kinds (e.g. moving expenses into
 * a savings or income category). That flips how the rows are counted and
 * re-weights the savings-rate maths on Pulse, so — unlike a same-kind move —
 * it earns a confirm that names the consequence. The common case never sees
 * this dialog; it only fires on a kind change.
 */
export function CrossKindConfirm({
  open,
  onOpenChange,
  count,
  noun,
  sourceKind,
  target,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  count: number;
  noun: string;
  sourceKind: CategoryKind;
  target: Category | null;
  onConfirm: () => void;
}) {
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Move into ${
        target ? `${target.emoji} ${target.name}` : "another category"
      }?`}
      description={
        target
          ? `${target.name} is ${target.kind === "income" ? "an" : "a"} ` +
            `${KIND_LABEL[target.kind]} category. Moving ${count} ${noun} out of ` +
            `${KIND_LABEL[sourceKind]} changes how they’re counted and shifts ` +
            `your savings rate.`
          : null
      }
      confirmLabel="Move anyway"
      onConfirm={onConfirm}
    />
  );
}
