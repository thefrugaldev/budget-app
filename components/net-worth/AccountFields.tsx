"use client";

import { AmountInput } from "@/components/budget/amount/AmountInput";
import { cn } from "@/lib/utils";
import type { AccountClass, AssetKind } from "@/types/net-worth";

const CLASS_OPTIONS: { value: AccountClass; label: string }[] = [
  { value: "asset", label: "Asset" },
  { value: "liability", label: "Liability" },
];

const KIND_OPTIONS: { value: AssetKind; label: string }[] = [
  { value: "cash", label: "Cash" },
  { value: "investment", label: "Investments" },
  { value: "property", label: "Property" },
];

/**
 * The controlled name / class / kind / balance fields shared by the create form
 * ({@link AccountForm}) and the edit sheet ({@link AccountEditSheet}), so the two
 * don't clone the class/kind pickers. Renders the hidden `class`/`kind` inputs
 * and the `balance` field (via the shared `AmountInput`, story 23) with the
 * right names, so a host `<form action={…}>` submits exactly what chunk 5's
 * actions parse. The parent owns the state (it drives which fields show).
 *
 * `balance` is shown for a liability or a non-investment asset; an investment
 * account is valued from its holdings, so it has no balance field (holdings are
 * edited separately). `classLocked` renders the class read-only — the server
 * refuses a class change once an account has recorded history, so the UI reflects
 * that rather than offering a control that would 409.
 */
export function AccountFields({
  name,
  onName,
  accountClass,
  onClass,
  kind,
  onKind,
  balance,
  onBalance,
  classLocked = false,
}: {
  name: string;
  onName: (value: string) => void;
  accountClass: AccountClass;
  onClass: (value: AccountClass) => void;
  kind: AssetKind;
  onKind: (value: AssetKind) => void;
  balance: string;
  onBalance: (value: string) => void;
  classLocked?: boolean;
}) {
  const isAsset = accountClass === "asset";
  const showBalance = !isAsset || kind !== "investment";
  // "Balance" is wrong for a house — a property is valued at its market value,
  // and the mortgage is a separate liability (ADR 0003). Kind-specific labels
  // remove the "equity vs. market value vs. amount owed" ambiguity.
  const balanceLabel = !isAsset ? "Amount owed" : kind === "property" ? "Estimated value" : "Balance";

  return (
    <div className="space-y-3">
      <label className="block space-y-1">
        <span className="text-xs font-medium text-muted-foreground">Name</span>
        <input
          name="name"
          value={name}
          onChange={(e) => onName(e.target.value)}
          placeholder="Brokerage"
          required
          aria-label="Account name"
          className="w-full rounded-md bg-background px-2 py-1.5 text-sm ring-1 ring-border outline-none focus:ring-ring"
        />
      </label>

      {/* Submitted even when the picker is locked (read-only) below — not a
          security concern: `updateAccountAction` refuses a class change once the
          account has history, so tampering this value only reproduces the
          current class. The server, not this input, is the gate. */}
      <input type="hidden" name="class" value={accountClass} />
      <div role="group" aria-label="Account type" className="space-y-1">
        <span className="block text-xs font-medium text-muted-foreground">Type</span>
        {classLocked ? (
          <p className="text-sm">
            {CLASS_OPTIONS.find((o) => o.value === accountClass)?.label}
            <span className="ml-2 text-[11px] text-muted-foreground">
              Locked — an account with recorded history can&rsquo;t change type.
            </span>
          </p>
        ) : (
          <div className="inline-flex w-full rounded-md bg-muted p-0.5 text-xs ring-1 ring-border">
            {CLASS_OPTIONS.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => onClass(o.value)}
                aria-pressed={accountClass === o.value}
                className={cn(
                  "flex-1 rounded-[5px] px-2 py-1 font-medium transition-colors",
                  accountClass === o.value
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {o.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {isAsset && (
        <div role="group" aria-label="Asset kind" className="space-y-1">
          <input type="hidden" name="kind" value={kind} />
          <span className="block text-xs font-medium text-muted-foreground">Kind</span>
          <div className="inline-flex w-full rounded-md bg-muted p-0.5 text-xs ring-1 ring-border">
            {KIND_OPTIONS.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => onKind(o.value)}
                aria-pressed={kind === o.value}
                className={cn(
                  "flex-1 rounded-[5px] px-2 py-1 font-medium transition-colors",
                  kind === o.value
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {showBalance ? (
        <label className="block space-y-1">
          <span className="text-xs font-medium text-muted-foreground">{balanceLabel}</span>
          <AmountInput
            name="balance"
            precision="cents"
            variant="field"
            value={balance}
            onChange={onBalance}
            allowZero
            ariaLabel={balanceLabel}
          />
          {isAsset && kind === "property" && (
            <span className="block text-[11px] text-muted-foreground">
              What it&rsquo;d sell for today — track the mortgage as a separate liability.
            </span>
          )}
        </label>
      ) : (
        <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
          Valued from its holdings — add positions below.
        </p>
      )}
    </div>
  );
}
