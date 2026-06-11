import type { Metadata } from "next";

import { ComingSoon } from "@/components/shell/ComingSoon";

export const metadata: Metadata = {
  title: "Transactions",
};

export default function TransactionsPage() {
  return (
    <ComingSoon
      icon="📜"
      title="Transactions"
      description="Every transaction across every category, with grouping, search, and filters — without having to open each category page."
    />
  );
}
