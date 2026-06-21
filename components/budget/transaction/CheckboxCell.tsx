import { Checkbox } from "@/components/ui/Checkbox";
import { cn } from "@/lib/utils";

/**
 * Selection checkbox column for a transaction row / streak header. Hidden on
 * every breakpoint until the user enters selection mode (via the "Select"
 * button, a row long-press, or Space on a focused row), so the resting list
 * stays a clean reading surface and bulk selection is an explicit, opt-in
 * task. `tabIndex={-1}` keeps it out of the roving-tabindex order — the row is
 * the single tab stop and Space toggles selection.
 */
export function CheckboxCell({
  show,
  label,
  checked,
  indeterminate,
  onCheckedChange,
  className,
}: {
  show: boolean;
  label: string;
  checked: boolean;
  indeterminate?: boolean;
  onCheckedChange: (checked: boolean) => void;
  className?: string;
}) {
  return (
    <label className={cn(show ? "flex" : "hidden", "shrink-0 items-center", className)}>
      <Checkbox
        label={label}
        checked={checked}
        indeterminate={indeterminate}
        onCheckedChange={onCheckedChange}
        tabIndex={-1}
      />
    </label>
  );
}
