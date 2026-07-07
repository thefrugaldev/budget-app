import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { SignOutButton } from "@/components/auth/SignOutButton";
import { EndedCategoriesList } from "@/components/settings/EndedCategoriesList";
import { ExportControl } from "@/components/settings/ExportControl";
import { InviteForm } from "@/components/settings/InviteForm";
import { MemberRow } from "@/components/settings/MemberRow";
import { PendingInviteRow } from "@/components/settings/PendingInviteRow";
import { ResetDataControl } from "@/components/settings/ResetDataControl";
import { RoleBadge } from "@/components/settings/RoleBadge";
import { SettingsSection } from "@/components/settings/SettingsSection";
import { ThemeControl } from "@/components/settings/ThemeControl";
import { getSession } from "@/lib/auth/session";
import { isCategoryEnded } from "@/lib/budget";
import { listCategories } from "@/lib/repositories/categories";
import { listInvitesByHousehold } from "@/lib/repositories/invites";
import { listMembersByHousehold } from "@/lib/repositories/members";
import { listUsersByIds } from "@/lib/repositories/users";
import type { Invite, MemberWithEmail } from "@/types/auth";

export const metadata: Metadata = {
  title: "Settings",
};

/**
 * Settings is a fixed stack of titled sections so every preference and data
 * control has a predictable home.
 *
 * Section order: **Profile** (identity + sign-out, for everyone — #111 chunk 6
 * replaces the reserved "Account" placeholder), then **Members & Invites**
 * (owner-only management — story 11), **Appearance**, **Data**, **Categories**,
 * and a **Danger zone** now gated to the owner (story 8). Non-owner members see
 * Profile through Categories; the management and destructive sections simply
 * don't render for them — and every underlying action re-checks the role
 * server-side, so hiding a section is never the security boundary (story 13).
 */
export default async function SettingsPage() {
  const session = await getSession();
  // The `(app)` layout already gates non-active sessions (signed-out → sign-in,
  // denied → private-app screen). This narrows the union for TypeScript and is a
  // defensive backstop if this page is ever reached outside that layout.
  if (session.status !== "active") redirect("/sign-in");

  const { user, membership } = session;
  const isOwner = membership.role === "owner";

  // Most-recently-ended first: a mis-retirement is the usual reason to open
  // this section, so the newest end date belongs at the top (listCategories
  // returns name order, which isn't the useful order here).
  const endedCategories = (await listCategories())
    .filter(isCategoryEnded)
    .sort((a, b) => (b.activeUntil ?? "").localeCompare(a.activeUntil ?? ""));

  // Members & pending invites are owner-only, so only load them for the owner.
  let members: MemberWithEmail[] = [];
  let pendingInvites: Invite[] = [];
  if (isOwner) {
    const householdId = membership.householdId;
    const rawMembers = await listMembersByHousehold(householdId);
    const users = await listUsersByIds(rawMembers.map((m) => m.userId));
    const emailByUserId = new Map(users.map((u) => [u.id, u.email]));
    members = rawMembers
      .map((m) => ({ ...m, email: emailByUserId.get(m.userId) ?? "(unknown)" }))
      // Owner first, then members alphabetically by email.
      .sort((a, b) =>
        a.role === "owner"
          ? -1
          : b.role === "owner"
            ? 1
            : a.email.localeCompare(b.email),
      );
    pendingInvites = (await listInvitesByHousehold(householdId))
      .filter((i) => i.status === "pending")
      .sort((a, b) => a.email.localeCompare(b.email));
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-10">
      <h1 className="mb-6 font-heading text-display font-semibold">
        Settings
      </h1>

      <div className="space-y-6">
        <SettingsSection
          title="Profile"
          description="The account you're signed in with, and your role in this household."
        >
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate font-medium">{user.email}</p>
              <div className="mt-1">
                <RoleBadge role={membership.role} />
              </div>
            </div>
            <SignOutButton />
          </div>
        </SettingsSection>

        {isOwner ? (
          <SettingsSection
            title="Members & Invites"
            description="Invite people by email, change roles, or revoke access. Only the owner can manage members."
          >
            <div className="space-y-6">
              <InviteForm />

              <div>
                <h3 className="text-sm font-semibold text-muted-foreground">
                  Members
                </h3>
                <ul className="mt-2 space-y-2">
                  {members.map((member) => (
                    <MemberRow
                      key={member.userId}
                      member={member}
                      isSelf={member.userId === user.id}
                    />
                  ))}
                </ul>
              </div>

              {pendingInvites.length > 0 ? (
                <div>
                  <h3 className="text-sm font-semibold text-muted-foreground">
                    Pending invites
                  </h3>
                  <ul className="mt-2 space-y-2">
                    {pendingInvites.map((invite) => (
                      <PendingInviteRow key={invite.id} invite={invite} />
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          </SettingsSection>
        ) : null}

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

        {isOwner ? (
          <SettingsSection
            title="Danger zone"
            description="Reset or clear your data — kept apart on purpose, and gated behind a confirmation."
            tone="danger"
          >
            <ResetDataControl />
          </SettingsSection>
        ) : null}
      </div>
    </div>
  );
}
