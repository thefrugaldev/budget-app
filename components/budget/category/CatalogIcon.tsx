"use client";

import { createElement } from "react";

import { catalogIconByName } from "@/lib/category/icon-catalog";
import { DEFAULT_CATEGORY_ICON } from "@/lib/category/icon";

/**
 * Renders any lucide icon by name from the full catalogue. Imports the heavy
 * catalogue, so it's only ever reached through `LazyLucideIcon`'s dynamic
 * import — never on the static render path.
 */
export default function CatalogIcon({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  return createElement(catalogIconByName(name) ?? DEFAULT_CATEGORY_ICON, {
    "aria-hidden": true,
    className,
  });
}
