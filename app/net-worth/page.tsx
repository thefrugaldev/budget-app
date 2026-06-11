import type { Metadata } from "next";

import { ComingSoon } from "@/components/shell/ComingSoon";

export const metadata: Metadata = {
  title: "Net worth",
};

export default function NetWorthPage() {
  return (
    <ComingSoon
      icon="📈"
      title="Net worth"
      description="Accounts (checking, savings, investments), goals, and a net-worth trajectory over time. The FIRE-side of the app."
    />
  );
}
