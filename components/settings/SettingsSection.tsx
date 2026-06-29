import { cn } from "@/lib/utils";

/**
 * A titled section card for the Settings page. The page is a fixed stack of
 * these — Account (reserved), Appearance, Data, Categories, Danger zone — so a
 * control always has a predictable home. `tone="danger"` gives the destructive
 * section its own visual treatment without changing the layout.
 *
 * Sections start as shells; later chunks fill `children` with the real controls
 * (theme toggle, CSV export, ended-category list, reset).
 */
export function SettingsSection({
  title,
  description,
  tone = "default",
  badge,
  children,
}: {
  title: string;
  description?: string;
  tone?: "default" | "danger";
  /** Inline marker beside the title — e.g. a "Soon" badge on a reserved section. */
  badge?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <section
      className={cn(
        "rounded-2xl bg-card p-5 ring-1",
        tone === "danger" ? "ring-destructive/40" : "ring-border",
      )}
    >
      <div className="flex items-center gap-2">
        <h2
          className={cn(
            "font-heading text-lg font-semibold tracking-tight",
            tone === "danger" && "text-destructive",
          )}
        >
          {title}
        </h2>
        {badge}
      </div>
      {description ? (
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      ) : null}
      {children ? <div className="mt-4">{children}</div> : null}
    </section>
  );
}
