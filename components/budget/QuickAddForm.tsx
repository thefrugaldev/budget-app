import type { Category } from "@/types/budget";

/**
 * Inline form for adding a transaction to a single category. The submit
 * handler is intentionally a no-op for now — wire to `createTransaction()`
 * (or a server action) when persistence is ready.
 */
export function QuickAddForm({
  category,
  defaultDate,
}: {
  category: Category;
  /** ISO date (YYYY-MM-DD). Defaults to today's UTC date if omitted. */
  defaultDate?: string;
}) {
  const today = defaultDate ?? new Date().toISOString().slice(0, 10);
  const verb = category.kind === "savings" ? "Save to" : "Add to";

  return (
    <form className="space-y-2 text-sm" action="#">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {verb} {category.name}
      </h2>
      <input
        type="date"
        name="date"
        defaultValue={today}
        className="w-full rounded-md bg-background px-2 py-1.5 ring-1 ring-border outline-none focus:ring-ring"
      />
      <input
        name="vendor"
        placeholder={category.kind === "savings" ? "Account / source" : "Vendor"}
        className="w-full rounded-md bg-background px-2 py-1.5 ring-1 ring-border outline-none focus:ring-ring"
      />
      <input
        name="amount"
        placeholder="$0.00"
        inputMode="decimal"
        className="w-full rounded-md bg-background px-2 py-1.5 text-right tabular-nums ring-1 ring-border outline-none focus:ring-ring"
      />
      <input
        name="details"
        placeholder="Details / items (optional, comma-separated)"
        className="w-full rounded-md bg-background px-2 py-1.5 text-xs ring-1 ring-border outline-none focus:ring-ring"
      />
      <button
        type="submit"
        className="w-full rounded-md bg-primary px-2 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/80"
      >
        Add transaction
      </button>
    </form>
  );
}
