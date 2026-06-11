import Link from "next/link";

export function ComingSoon({
  icon,
  title,
  description,
  pointer,
}: {
  icon: string;
  title: string;
  description: string;
  /**
   * Optional callout pointing users to where today's equivalent functionality
   * lives — e.g. Income's pencil on Pulse, or Categories on the dashboard.
   */
  pointer?: {
    label: string;
    text: string;
    href?: string;
  };
}) {
  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-16 sm:py-24">
      <div className="rounded-2xl bg-card p-8 text-center ring-1 ring-border sm:p-12">
        <div aria-hidden className="mb-4 text-5xl">
          {icon}
        </div>
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Coming soon
        </p>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          {title}
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">{description}</p>
        {pointer ? (
          <p className="mt-6 text-sm">
            <span className="text-muted-foreground">{pointer.label}: </span>
            {pointer.href ? (
              <Link
                href={pointer.href}
                className="font-medium text-foreground underline-offset-2 hover:underline"
              >
                {pointer.text}
              </Link>
            ) : (
              <span className="font-medium text-foreground">{pointer.text}</span>
            )}
          </p>
        ) : null}
      </div>
    </div>
  );
}
