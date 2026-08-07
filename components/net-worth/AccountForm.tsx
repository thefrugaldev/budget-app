"use client";

import { useActionState, useState } from "react";

import { createAccountAction } from "@/app/actions/net-worth";
import { NET_WORTH_ACTION_INITIAL } from "@/app/actions/net-worth-state";
import { AccountFields } from "@/components/net-worth/AccountFields";
import { DialogFooter } from "@/components/ui/DialogFooter";
import { FormSubmitButton } from "@/components/ui/FormSubmitButton";
import { useActionSuccessToast } from "@/hooks/useActionSuccessToast";
import type { AccountClass, AssetKind } from "@/types/net-worth";

/**
 * Form for creating an account (#109 chunk 7, story 3). An asset carries a kind
 * (cash / investment / property); a liability is manual-balance. A cash /
 * property / liability account takes a starting balance here; an **investment**
 * account is created empty and gains its holdings in the edit sheet's holdings
 * editor (story 4) — chunk 5's `createAccountAction` takes no holdings, so the
 * flow is create → edit → add positions. Mirrors `CategoryForm`.
 */
export function AccountForm({
  institutions,
  onSuccess,
  cancelSlot,
}: {
  /** The household's prior institution values, for the field's autocomplete. */
  institutions: string[];
  onSuccess?: (id: string) => void;
  /**
   * Dismiss control rendered to the left of the submit in the shared footer
   * row (a `DialogFooterCancel` when hosted in a dialog). Kept a slot rather
   * than hardcoded so the form stays dialog-agnostic for inline call sites,
   * which simply omit it — the submit then sits alone, right-aligned.
   */
  cancelSlot?: React.ReactNode;
}) {
  const [state, formAction] = useActionState(createAccountAction, NET_WORTH_ACTION_INITIAL);
  // Shared success idiom; the generic hook hands back the action state so we can
  // forward the new account's id (createAccountAction always returns it on success).
  useActionSuccessToast(state, () => "Account added", (s) => {
    if (s.id) onSuccess?.(s.id);
  });

  const [name, setName] = useState("");
  const [institution, setInstitution] = useState("");
  const [accountClass, setAccountClass] = useState<AccountClass>("asset");
  const [kind, setKind] = useState<AssetKind>("cash");
  const [balance, setBalance] = useState("");

  return (
    <form action={formAction} className="space-y-3">
      <AccountFields
        name={name}
        onName={setName}
        institution={institution}
        onInstitution={setInstitution}
        institutions={institutions}
        accountClass={accountClass}
        onClass={setAccountClass}
        kind={kind}
        onKind={setKind}
        balance={balance}
        onBalance={setBalance}
      />

      {state.error && (
        <p role="alert" className="text-xs text-destructive">
          {state.error}
        </p>
      )}

      <DialogFooter className="pt-1">
        {cancelSlot}
        <FormSubmitButton label="Add account" pendingLabel="Adding…" />
      </DialogFooter>
    </form>
  );
}
