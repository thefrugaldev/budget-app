import type { Metadata } from "next";

import { SettingsSection } from "@/components/settings/SettingsSection";

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
 * This chunk lays out the shells; each section's description names the control
 * it will hold, and the controls themselves arrive in later chunks — the theme
 * toggle (chunk 2), CSV export (chunk 3), ended-category management (chunk 4),
 * and the guarded reset (chunk 5).
 */
export default function SettingsPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-10">
      <h1 className="mb-6 font-heading text-3xl font-semibold tracking-tight">
        Settings
      </h1>

      <div className="space-y-4">
        <SettingsSection
          title="Account"
          description="Sign-in, profile, and sign-out arrive when accounts land — reserved here so it has an obvious home. This app is single-user today, so there's nothing to manage yet."
        />

        <SettingsSection
          title="Appearance"
          description="The light / dark / system theme control moves here from the header."
        />

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
