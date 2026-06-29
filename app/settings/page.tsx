import type { Metadata } from "next";

import { SettingsSection } from "@/components/settings/SettingsSection";
import { ThemeControl } from "@/components/settings/ThemeControl";
import { SoonBadge } from "@/components/shell/SoonBadge";

export const metadata: Metadata = {
  title: "Settings",
};

/**
 * Settings is a fixed stack of titled sections so every preference and data
 * control has a predictable home (replacing the old "Coming soon" stub).
 *
 * Section order is intentional: a reserved **Account** seam sits at the top so
 * sign-in/profile have an unambiguous future home when auth lands (#81 keeps it
 * a placeholder, doesn't build it), then **Appearance**, **Data**,
 * **Categories**, and a visually-isolated **Danger zone**.
 *
 * Appearance now hosts the real theme control (chunk 2); the remaining controls
 * arrive in later chunks — CSV export (chunk 3), ended-category management
 * (chunk 4), and the guarded reset (chunk 5).
 */
export default function SettingsPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-10">
      <h1 className="mb-6 font-heading text-3xl font-semibold tracking-tight">
        Settings
      </h1>

      <div className="space-y-6">
        <SettingsSection
          title="Account"
          badge={<SoonBadge />}
          description="Sign-in, profile, and sign-out arrive when accounts land — reserved here so it has an obvious home. This app is single-user today, so there's nothing to manage yet."
        />

        <SettingsSection
          title="Appearance"
          description="Choose how the app looks. System follows your device setting."
        >
          <ThemeControl />
        </SettingsSection>

        <SettingsSection
          title="Data"
          description="Export your transactions to CSV — a portable copy of everything you've entered."
        />

        <SettingsSection
          title="Categories"
          description="Review and reopen categories that Pulse hides because their active range has ended."
        />

        <SettingsSection
          title="Danger zone"
          description="Reset or clear your data — kept apart on purpose, and gated behind a confirmation."
          tone="danger"
        />
      </div>
    </div>
  );
}
