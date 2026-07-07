"use client";

import { useActionState, useRef, useState } from "react";

import { changeMemberRoleAction, removeMemberAction } from "@/app/actions/members";
import { MEMBER_ACTION_INITIAL } from "@/app/actions/members-state";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { useActionSuccessToast } from "@/hooks/useActionSuccessToast";
import { useNotify } from "@/hooks/useNotify";
import type { MemberWithEmail } from "@/types/auth";

import { RoleBadge } from "./RoleBadge";
import { INVITABLE_ROLES, ROLE_LABELS } from "./roleLabels";

const SELECT_CLASSES =
  "rounded-md bg-background px-2 py-1 text-xs font-medium ring-1 ring-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/**
 * One row in the owner's Members list (#111 story 11). The owner's own row is
 * read-only (a badge, marked "You") — role change and removal both refuse to
 * touch the owner server-side (ADR 0004: one owner, transfer out of scope), so
 * the UI simply omits controls that would only ever be rejected. Editor/viewer
 * rows get a role select (change between the two) and a confirmed remove.
 *
 * Enforcement is entirely server-side; this component decides affordances, not
 * access. Role change submits the little `<select>` form on change; removal
 * routes through {@link ConfirmDialog} and calls the action directly (like the
 * danger-zone reset) since it's a confirm callback, not a form submit.
 */
export function MemberRow({
  member,
  isSelf,
}: {
  member: MemberWithEmail;
  isSelf: boolean;
}) {
  const notify = useNotify();

  const [roleState, roleAction] = useActionState(
    changeMemberRoleAction,
    MEMBER_ACTION_INITIAL,
  );
  const roleFormRef = useRef<HTMLFormElement>(null);
  useActionSuccessToast(roleState, () => `${member.email}'s role updated`);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [removing, setRemoving] = useState(false);

  async function handleRemove() {
    setRemoving(true);
    try {
      const formData = new FormData();
      formData.set("userId", member.userId);
      const { error } = await removeMemberAction(MEMBER_ACTION_INITIAL, formData);
      setConfirmOpen(false);
      if (error) {
        notify.error("Couldn't remove member", error);
      } else {
        notify.success(`${member.email} removed`);
      }
    } finally {
      setRemoving(false);
    }
  }

  const isOwner = member.role === "owner";

  return (
    <li className="flex items-center justify-between gap-3 rounded-lg bg-background px-3 py-2 ring-1 ring-border">
      <div className="flex min-w-0 items-center gap-2">
        <span className="truncate font-medium">{member.email}</span>
        {isSelf ? (
          <span className="shrink-0 text-xs text-muted-foreground">You</span>
        ) : null}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {roleState.error ? (
          <span role="alert" className="text-xs text-destructive">
            {roleState.error}
          </span>
        ) : null}

        {isOwner ? (
          <RoleBadge role={member.role} />
        ) : (
          <>
            <form ref={roleFormRef} action={roleAction}>
              <input type="hidden" name="userId" value={member.userId} />
              <label htmlFor={`role-${member.userId}`} className="sr-only">
                Role for {member.email}
              </label>
              <select
                id={`role-${member.userId}`}
                name="role"
                defaultValue={member.role}
                onChange={() => roleFormRef.current?.requestSubmit()}
                className={SELECT_CLASSES}
              >
                {INVITABLE_ROLES.map((role) => (
                  <option key={role} value={role}>
                    {ROLE_LABELS[role]}
                  </option>
                ))}
              </select>
            </form>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => setConfirmOpen(true)}
              disabled={removing}
            >
              {removing ? "Removing…" : "Remove"}
            </Button>
          </>
        )}
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        tone="destructive"
        title="Remove member?"
        description={`${member.email} will lose access to this household. Their data stays; they can be re-invited later.`}
        confirmLabel="Remove"
        onConfirm={handleRemove}
      />
    </li>
  );
}
