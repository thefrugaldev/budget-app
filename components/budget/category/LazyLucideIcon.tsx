"use client";

import dynamic from "next/dynamic";

/**
 * Renders a lucide icon by name from the full catalogue, lazy-loaded. Used by
 * `CategoryIcon` for the rare category whose chosen icon isn't in the curated
 * static set — the ~170KB catalogue chunk only downloads when such an icon
 * actually needs rendering (and is shared with the picker), so the common path
 * stays instant and light.
 */
const CatalogIcon = dynamic(() => import("./CatalogIcon"), {
  ssr: false,
  loading: () => null,
});

export function LazyLucideIcon({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  return <CatalogIcon name={name} className={className} />;
}
