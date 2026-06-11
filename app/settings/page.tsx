import type { Metadata } from "next";

import { ComingSoon } from "@/components/shell/ComingSoon";

export const metadata: Metadata = {
  title: "Settings",
};

export default function SettingsPage() {
  return (
    <ComingSoon
      icon="⚙️"
      title="Settings"
      description="Preferences, data import/export, theme, and account controls."
    />
  );
}
