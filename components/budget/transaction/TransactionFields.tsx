"use client";

import { useState } from "react";

import { AmountInput } from "@/components/budget/amount/AmountInput";
import { CompactField } from "@/components/budget/transaction/CompactField";
import { FieldRow } from "@/components/budget/transaction/FieldRow";
import { SignControl } from "@/components/budget/transaction/SignControl";
import { VendorInput } from "@/components/budget/transaction/VendorInput";
import { DatePickerField } from "@/components/ui/DatePickerField";
import { signLabelsFor } from "@/lib/budget";
import type { CategoryKind, Transaction } from "@/types/budget";

/**
 * The body of the form: date, signed amount, vendor, note. Its `key` includes
 * the active category + a reset counter so the inputs remount (clearing local
 * state) when the user picks a different category or completes a save.
 * State stays internal — the parent only reads values back when the form
 * submits, via the `name`-mapped form data.
 */
export function TransactionFields({
  kind,
  prefill,
  vendorOptions,
  useDateFromPrefill,
  requireVendor,
  compact,
  submitButton,
}: {
  kind: CategoryKind | undefined;
  prefill: Transaction | undefined;
  vendorOptions: string[];
  /**
   * Add mode opens blank — no pre-fill and no today-default (#166 story
   * 21/25), so the owner enters the date they intend rather than accepting a
   * default they might overlook. Edit mode pre-fills the date from the row
   * being edited, so the form round-trips an existing transaction without
   * surprising re-dating.
   */
  useDateFromPrefill: boolean;
  /**
   * Add mode requires a vendor (#166 story 23); edit mode leaves it optional so
   * a vendorless imported row (e.g. an archive "Monthly total") still saves.
   */
  requireVendor: boolean;
  /** Compact one-row layout for the category detail page (issue #15 chunk 1). */
  compact: boolean;
  /** Rendered inside the compact row's trailing group so Add sits inline with the fields. */
  submitButton: React.ReactNode;
}) {
  const initialDate = useDateFromPrefill ? prefill?.date ?? "" : "";
  const [date, setDate] = useState(initialDate);
  const [amount, setAmount] = useState(prefill ? Math.abs(prefill.amount).toString() : "");
  const [sign, setSign] = useState<"+" | "-">(prefill && prefill.amount < 0 ? "-" : "+");
  const [vendor, setVendor] = useState(prefill?.vendor ?? "");
  const [note, setNote] = useState(prefill?.note ?? "");
  // Auto-open when prefill carried a note so its value remains visible — hiding
  // a populated textarea behind a "+ Note" toggle would silently re-submit the
  // previous transaction's note.
  const [noteOpen, setNoteOpen] = useState(Boolean(prefill?.note));

  const signLabels = signLabelsFor(kind ?? "expense");
  const vendorPlaceholder = kind === "savings" ? "Account / source" : "Vendor";

  if (compact) {
    return (
      <div className="space-y-3">
        <input type="hidden" name="sign" value={sign} />

        {/* Amount leads as the big display (size "md" to fit the sidebar), with
            the sign control beneath — consistent with the Add-transaction
            dialog. The remaining fields stay in a dense wrapping row below. */}
        <div className="flex flex-col items-center gap-2">
          <AmountInput
            name="amount"
            value={amount}
            onChange={setAmount}
            variant="display"
            size="md"
            required
            ariaLabel="Amount"
          />
          <SignControl labels={signLabels} value={sign} onChange={setSign} />
        </div>

        <div className="flex flex-col gap-2 md:flex-row md:flex-wrap md:items-end md:gap-3">
          <CompactField label="Date" className="md:w-44">
            <DatePickerField
              value={date}
              onChange={setDate}
              name="date"
              required
              ariaLabel="Transaction date"
            />
          </CompactField>

          <CompactField label="Vendor" className="md:min-w-40 md:flex-1">
            <VendorInput
              value={vendor}
              onChange={setVendor}
              options={vendorOptions}
              placeholder={vendorPlaceholder}
              required={requireVendor}
            />
          </CompactField>

          {noteOpen ? (
            // w-full + md:order-last so the Note wraps onto its own row below the
            // main fields at md+, while keeping its natural DOM-order spot above
            // the trailing group on mobile (no explicit order class applies).
            <CompactField label="Note" className="w-full md:order-last">
              <textarea
                name="note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                placeholder="Optional"
                className="w-full resize-none rounded-md bg-background px-2 py-1.5 text-sm ring-1 ring-border outline-none focus:ring-ring"
              />
            </CompactField>
          ) : (
            <input type="hidden" name="note" value={note} />
          )}

          <div className="flex items-end gap-2 md:ml-auto">
            {!noteOpen && (
              <button
                type="button"
                onClick={() => setNoteOpen(true)}
                className="cursor-pointer rounded-md bg-muted px-3 py-2 text-sm font-medium text-muted-foreground ring-1 ring-border hover:bg-muted/80 hover:text-foreground"
              >
                + Note
              </button>
            )}
            {submitButton}
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <input type="hidden" name="sign" value={sign} />

      <FieldRow label="Date">
        <DatePickerField
          value={date}
          onChange={setDate}
          name="date"
          required
          ariaLabel="Transaction date"
        />
      </FieldRow>

      <FieldRow label="Amount">
        <div className="flex flex-col items-center gap-3">
          <AmountInput
            name="amount"
            value={amount}
            onChange={setAmount}
            variant="display"
            required
            autoFocus
            ariaLabel="Amount"
          />
          <SignControl labels={signLabels} value={sign} onChange={setSign} />
        </div>
      </FieldRow>

      <FieldRow label="Vendor">
        <VendorInput
          value={vendor}
          onChange={setVendor}
          options={vendorOptions}
          placeholder={vendorPlaceholder}
          required={requireVendor}
        />
      </FieldRow>

      <FieldRow label="Note">
        <textarea
          name="note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          placeholder="Optional"
          className="w-full resize-none rounded-md bg-background px-2 py-1.5 text-sm ring-1 ring-border outline-none focus:ring-ring"
        />
      </FieldRow>
    </>
  );
}
