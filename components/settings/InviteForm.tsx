"use client";

import { useActionState, useRef } from "react";

import { createInviteAction } from "@/app/actions/members";
import { MEMBER_ACTION_INITIAL } from "@/app/actions/members-state";
import { FormSubmitButton } from "@/components/ui/FormSubmitButton";
import { useActionSuccessToast } from "@/hooks/useActionSuccessToast";

import { INVITABLE_ROLES, ROLE_LABELS } from "./roleLabels";

const FIELD_CLASSES =
  "w-full rounded-md bg-background px-3 py-2 text-sm ring-1 ring-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/**
 * Owner-only invite creation (#111 story 4). Email + role → a pending invite;
 * matching happens on the invitee's next sign-in, no email is sent. All
 * enforcement is server-side (`createInviteAction` calls `requireRole("owner")`);
 * this form is only shown to the owner, but hiding it is never the boundary.
 *
 * Because sign-up is Restricted (ADR 0004), a brand-new invitee also needs a
 * Clerk identity to authenticate at all — the persistent note spells out that
 * one manual dashboard step so an owner isn't left wondering why the invite
 * "doesn't work" until the person is provisioned.
 */
export function InviteForm() {
  const [state, action] = useActionState(
    createInviteAction,
    MEMBER_ACTION_INITIAL,
  );
  const formRef = useRef<HTMLFormElement>(null);
  useActionSuccessToast(
    state,
    () => "Invite created — remember to add them in Clerk",
    () => formRef.current?.reset(),
  );

  return (
    <div className="space-y-3">
      <form
        ref={formRef}
        action={action}
        className="flex flex-col gap-3 sm:flex-row sm:items-end"
      >
        <div className="flex-1">
          <label
            htmlFor="invite-email"
            className="block text-sm font-medium"
          >
            Email
          </label>
          <input
            id="invite-email"
            name="email"
            type="email"
            autoComplete="off"
            placeholder="person@example.com"
            className={`mt-1 ${FIELD_CLASSES}`}
          />
        </div>
        <div className="sm:w-40">
          <label htmlFor="invite-role" className="block text-sm font-medium">
            Role
          </label>
          <select
            id="invite-role"
            name="role"
            defaultValue="editor"
            className={`mt-1 ${FIELD_CLASSES}`}
          >
            {INVITABLE_ROLES.map((role) => (
              <option key={role} value={role}>
                {ROLE_LABELS[role]}
              </option>
            ))}
          </select>
        </div>
        <FormSubmitButton
          label="Send invite"
          pendingLabel="Creating…"
          className="h-10 sm:mb-0.5"
        />
      </form>

      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}

      <p className="text-xs text-muted-foreground">
        No email is sent. The invite is claimed when they sign in with the
        matching Google account. A first-time invitee must also be added in the
        Clerk dashboard (Users → Create user) before they can sign in.
      </p>
    </div>
  );
}
