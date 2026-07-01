import type { Metadata } from "next";

import { EndedCategoriesList } from "@/components/settings/EndedCategoriesList";
import { ExportControl } from "@/components/settings/ExportControl";
import { SettingsSection } from "@/components/settings/SettingsSection";
import { ThemeControl } from "@/components/settings/ThemeControl";
import { SoonBadge } from "@/components/shell/SoonBadge";
import { isCategoryEnded } from "@/lib/budget";
import { listCategories } from "@/lib/repositories/categories";

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
 * Appearance hosts the real theme control (chunk 2), Data hosts CSV export
 * (chunk 3), and Categories now lists ended categories for reopen (chunk 4).
 * The guarded reset (chunk 5) is the remaining shell. Reading the ended-category
 * list makes this route server-rendered on demand rather than static.
 */
export default async function SettingsPage() {
  // Most-recently-ended first: a mis-retirement is the usual reason to open
  // this section, so the newest end date belongs at the top (listCategories
  // returns name order, which isn't the useful order here).
  const endedCategories = (await listCategories())
    .filter(isCategoryEnded)
    .sort((a, b) => (b.activeUntil ?? "").localeCompare(a.activeUntil ?? ""));

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
        >
          <ExportControl />
        </SettingsSection>

        <SettingsSection
          title="Categories"
          description="Review and reopen categories that Pulse hides because their active range has ended."
        >
          <EndedCategoriesList categories={endedCategories} />
        </SettingsSection>

        <SettingsSection
          title="Danger zone"
          description="Reset or clear your data — kept apart on purpose, and gated behind a confirmation."
          tone="danger"
        />
      </div>
    </div>
  );
}
