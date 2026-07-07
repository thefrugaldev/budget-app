import { redirect } from "next/navigation";

import { PrivateAppScreen } from "@/components/auth/PrivateAppScreen";
import { RoleProvider } from "@/components/auth/RoleProvider";
import { AppShell } from "@/components/shell/AppShell";
import { getSession } from "@/lib/auth/session";

/**
 * The authenticated application shell. Resolving the session here is the
 * server-side gate (the proxy redirect is only optimistic) and also triggers
 * the lazy first-sign-in bootstrap. The sign-in screen sits outside this group,
 * so it renders without the app chrome.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  // Backstop for the proxy's optimistic redirect (e.g. a Server Function whose
  // route the matcher missed): a signed-out request never reaches app data.
  if (session.status === "signed-out") redirect("/sign-in");

  // Authenticated but uninvited — the private-app screen, no nav, no data
  // access, no residue (story 6).
  if (session.status === "denied") return <PrivateAppScreen />;

  // Thread the role to client components so viewers see edit affordances hidden
  // (#111 chunk 7, story 9). Enforcement stays server-side; this is UI only.
  return (
    <RoleProvider role={session.membership.role}>
      <AppShell>{children}</AppShell>
    </RoleProvider>
  );
}
