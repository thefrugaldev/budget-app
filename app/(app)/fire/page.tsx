import type { Metadata } from "next";

import { ComingSoon } from "@/components/shell/ComingSoon";

export const metadata: Metadata = {
  title: "FIRE",
};

export default function FirePage() {
  return (
    <ComingSoon
      icon="🔥"
      title="FIRE"
      description="Financial Independence, Retire Early — track your savings rate, runway, and progress toward a target nest egg, built on the same transaction data."
      pointer={{
        label: "For now",
        text: "watch your savings rate on Pulse",
        href: "/",
      }}
    />
  );
}
