import { cn } from "@/lib/utils";

/**
 * Labelled field wrapper for the compact one-row {@link TransactionForm}
 * layout used inline on the category detail page (issue #15, chunk 1).
 */
export function CompactField({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={cn("flex flex-col gap-1", className)}>
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
