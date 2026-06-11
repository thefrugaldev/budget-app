import type { Metadata } from "next";

import { ComingSoon } from "@/components/shell/ComingSoon";

export const metadata: Metadata = {
  title: "Categories",
};

export default function CategoriesPage() {
  return (
    <ComingSoon
      icon="📂"
      title="Categories"
      description="A dedicated place to manage every expense, savings, and income category in one view — caps, lifecycle, and history together."
      pointer={{
        label: "For now",
        text: "manage categories from the Pulse dashboard",
        href: "/",
      }}
    />
  );
}
