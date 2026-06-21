/**
 * Labelled field wrapper for the default stacked {@link TransactionForm}
 * layout (Add dialog / non-compact placements).
 */
export function FieldRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
