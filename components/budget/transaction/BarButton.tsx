/**
 * Icon+label action button used inside {@link BulkActionBar}. The label
 * collapses to an icon-only button below `sm` so all actions fit a narrow
 * phone; the accessible name is preserved via `title` + an sr-only span.
 */
export function BarButton({
  onClick,
  icon,
  label,
  destructive = false,
}: {
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  destructive?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      // The label collapses to an icon-only button below `sm` so all four
      // actions fit the bar on a narrow phone; the accessible name is kept.
      title={label}
      className={
        "inline-flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1.5 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring " +
        (destructive
          ? "text-rose-700 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950"
          : "text-foreground hover:bg-muted")
      }
    >
      {icon}
      <span className="sr-only md:not-sr-only">{label}</span>
    </button>
  );
}
