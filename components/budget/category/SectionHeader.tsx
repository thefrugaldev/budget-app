/**
 * Section label inside the category Edit sheet, with an amber dirty-dot that
 * appears when the section has unsaved edits.
 */
export function SectionHeader({ title, dirty }: { title: string; dirty: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      {dirty && (
        <span
          aria-label="Unsaved changes"
          title="Unsaved changes"
          className="inline-block size-1.5 rounded-full bg-amber-500"
        />
      )}
    </div>
  );
}
