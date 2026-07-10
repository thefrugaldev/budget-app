"use client";

import { useActionState, useEffect, useRef, useState } from "react";

import { createAccountAction } from "@/app/actions/net-worth";
import { NET_WORTH_ACTION_INITIAL } from "@/app/actions/net-worth-state";
import { AccountFields } from "@/components/net-worth/AccountFields";
import { FormSubmitButton } from "@/components/ui/FormSubmitButton";
import { useNotify } from "@/hooks/useNotify";
import type { AccountClass, AssetKind } from "@/types/net-worth";

/**
 * Form for creating an account (#109 chunk 7, story 3). An asset carries a kind
 * (cash / investment / property); a liability is manual-balance. A cash /
 * property / liability account takes a starting balance here; an **investment**
 * account is created empty and gains its holdings in the edit sheet's holdings
 * editor (story 4) — chunk 5's `createAccountAction` takes no holdings, so the
 * flow is create → edit → add positions. Mirrors `CategoryForm`.
 */
export function AccountForm({ onSuccess }: { onSuccess?: (id: string) => void }) {
  const [state, formAction] = useActionState(createAccountAction, NET_WORTH_ACTION_INITIAL);
  const notify = useNotify();
  const lastOk = useRef(state.ok);
  useEffect(() => {
    if (state.ok > lastOk.current && !state.error && state.id) {
      lastOk.current = state.ok;
      notify.success("Account added");
      onSuccess?.(state.id);
    }
  }, [state, notify, onSuccess]);

  const [name, setName] = useState("");
  const [accountClass, setAccountClass] = useState<AccountClass>("asset");
  const [kind, setKind] = useState<AssetKind>("cash");
  const [balance, setBalance] = useState("");

  return (
    <form action={formAction} className="space-y-3">
      <AccountFields
        name={name}
        onName={setName}
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

      <div className="flex justify-end pt-1">
        <FormSubmitButton label="Add account" pendingLabel="Adding…" />
      </div>
    </form>
  );
}
