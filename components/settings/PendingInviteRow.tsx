"use client";

import { useActionState } from "react";

import { revokeInviteAction } from "@/app/actions/members";
import { MEMBER_ACTION_INITIAL } from "@/app/actions/members-state";
import { FormSubmitButton } from "@/components/ui/FormSubmitButton";
import { useActionSuccessToast } from "@/hooks/useActionSuccessToast";
import type { Invite } from "@/types/auth";

import { RoleBadge } from "./RoleBadge";

/**
 * One pending-invite row in the owner's Members & Invites section (#111
 * story 11): the invited email, the role it grants, and a revoke control.
 * Revoke is low-stakes and re-creatable, so it skips the confirm dialog; the
 * server action is idempotent, so a raced double-revoke still reads as success.
 */
export function PendingInviteRow({ invite }: { invite: Invite }) {
  const [state, action] = useActionState(
    revokeInviteAction,
    MEMBER_ACTION_INITIAL,
  );
  useActionSuccessToast(state, () => `Invite to ${invite.email} revoked`);

  return (
    <li className="flex items-center justify-between gap-3 rounded-lg bg-background px-3 py-2 ring-1 ring-border">
      <div className="flex min-w-0 items-center gap-2">
        <span className="truncate font-medium">{invite.email}</span>
        <RoleBadge role={invite.role} />
        <span className="shrink-0 text-xs text-muted-foreground">Pending</span>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {state.error ? (
          <span role="alert" className="text-xs text-destructive">
            {state.error}
          </span>
        ) : null}
        <form action={action}>
          <input type="hidden" name="inviteId" value={invite.id} />
          <FormSubmitButton
            label="Revoke"
            pendingLabel="Revoking…"
            variant="ghost-destructive"
          />
        </form>
      </div>
    </li>
  );
}
