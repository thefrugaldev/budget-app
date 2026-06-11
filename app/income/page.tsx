import type { Metadata } from "next";

import { ComingSoon } from "@/components/shell/ComingSoon";

export const metadata: Metadata = {
  title: "Income",
};

export default function IncomePage() {
  return (
    <ComingSoon
      icon="💼"
      title="Income"
      description="Track every income source year-over-year, with baselines, bonuses, and growth — separate from the spending dashboard."
      pointer={{
        label: "For now",
        text: "edit income from the pencil on Pulse",
        href: "/",
      }}
    />
  );
}
