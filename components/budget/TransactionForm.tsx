"use client";

import { Autocomplete } from "@base-ui/react/autocomplete";
import { Check, ChevronDown, Search } from "lucide-react";
import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

import { createTransactionAction } from "@/app/actions/transactions";
import { TX_ACTION_INITIAL } from "@/app/actions/transactions-state";
import {
  mostRecentTransactionInCategory,
  signLabelsFor,
  vendorSuggestionsForCategory,
} from "@/lib/budget";
import { cn } from "@/lib/utils";
import type { Category, CategoryKind, Transaction } from "@/types/budget";

const KIND_LABELS = {
  expense: "Expenses",
  savings: "Savings",
  income: "Income",
} as const;
const KIND_ORDER = ["expense", "savings", "income"] as const;

type Mode = "add" | "edit";

export type TransactionFormProps = {
  mode?: Mode;
  categories: Category[];
  transactions: Transaction[];
  /** When present, the form opens with this category preselected (story 30). */
  initialCategoryId?: string;
  /** Called after a successful save — used by the dialog wrapper to close itself. */
  onSuccess?: () => void;
  /** Submit button label override; defaults to "Add transaction" / "Save changes". */
  submitLabel?: string;
  className?: string;
};

export function TransactionForm({
  mode = "add",
  categories,
  transactions,
  initialCategoryId,
  onSuccess,
  submitLabel,
  className,
}: TransactionFormProps) {
  const categoryMap = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories],
  );

  const [categoryId, setCategoryId] = useState<string | undefined>(initialCategoryId);
  // Bumps after every successful save — used as part of the Fields component's
  // `key` so the inputs remount with fresh defaults instead of carrying stale
  // text from the previous submission.
  const [resetCount, setResetCount] = useState(0);

  const selected = categoryId ? categoryMap.get(categoryId) : undefined;
  const prefill = useMemo(
    () => (categoryId ? mostRecentTransactionInCategory(transactions, categoryId) : undefined),
    [categoryId, transactions],
  );
  const vendorOptions = useMemo(
    () => (categoryId ? vendorSuggestionsForCategory(transactions, categoryId) : []),
    [categoryId, transactions],
  );

  const [state, formAction] = useActionState(
    createTransactionAction,
    TX_ACTION_INITIAL,
  );
  const lastOk = useRef(state.ok);
  useEffect(() => {
    if (state.ok > lastOk.current && !state.error) {
      lastOk.current = state.ok;
      onSuccess?.();
      setResetCount((c) => c + 1);
    }
  }, [state, onSuccess]);

  const defaultSubmitLabel = mode === "edit" ? "Save changes" : "Add transaction";

  return (
    <form action={formAction} className={cn("space-y-3", className)}>
      <input type="hidden" name="categoryId" value={categoryId ?? ""} />

      <CategoryPicker
        categories={categories}
        selectedId={categoryId}
        onChange={setCategoryId}
      />

      <TransactionFields
        key={`${categoryId ?? "_none_"}:${resetCount}`}
        kind={selected?.kind}
        prefill={prefill}
        vendorOptions={vendorOptions}
      />

      {state.error && (
        <p role="alert" className="text-xs text-destructive">
          {state.error}
        </p>
      )}

      <div className="flex justify-end pt-1">
        <SubmitButton
          disabled={!categoryId}
          label={submitLabel ?? defaultSubmitLabel}
          pendingLabel={mode === "edit" ? "Saving…" : "Adding…"}
        />
      </div>
    </form>
  );
}

/**
 * The body of the form: date, signed amount, vendor, note. Its `key` includes
 * the active category + a reset counter so the inputs remount (clearing local
 * state) when the user picks a different category or completes a save.
 * State stays internal — the parent only reads values back when the form
 * submits, via the `name`-mapped form data.
 */
function TransactionFields({
  kind,
  prefill,
  vendorOptions,
}: {
  kind: CategoryKind | undefined;
  prefill: Transaction | undefined;
  vendorOptions: string[];
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [amount, setAmount] = useState(prefill ? Math.abs(prefill.amount).toString() : "");
  const [sign, setSign] = useState<"+" | "-">(prefill && prefill.amount < 0 ? "-" : "+");
  const [vendor, setVendor] = useState(prefill?.vendor ?? "");
  const [note, setNote] = useState(prefill?.note ?? "");

  const signLabels = signLabelsFor(kind ?? "expense");

  return (
    <>
      <input type="hidden" name="sign" value={sign} />

      <FieldRow label="Date">
        <input
          type="date"
          name="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          required
          className="w-full rounded-md bg-background px-2 py-1.5 text-sm ring-1 ring-border outline-none focus:ring-ring"
        />
      </FieldRow>

      <FieldRow label="Amount">
        <div className="flex gap-2">
          <SignControl labels={signLabels} value={sign} onChange={setSign} />
          <input
            name="amount"
            type="text"
            inputMode="decimal"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
            className="w-full flex-1 rounded-md bg-background px-2 py-1.5 text-right text-sm tabular-nums ring-1 ring-border outline-none focus:ring-ring"
          />
        </div>
      </FieldRow>

      <FieldRow label="Vendor">
        <VendorInput
          value={vendor}
          onChange={setVendor}
          options={vendorOptions}
          placeholder={kind === "savings" ? "Account / source" : "Vendor"}
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

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function SignControl({
  labels,
  value,
  onChange,
}: {
  labels: { positive: string; negative: string };
  value: "+" | "-";
  onChange: (v: "+" | "-") => void;
}) {
  return (
    <div
      role="group"
      aria-label="Direction"
      className="inline-flex shrink-0 rounded-md bg-muted p-0.5 text-xs ring-1 ring-border"
    >
      <button
        type="button"
        onClick={() => onChange("+")}
        aria-pressed={value === "+"}
        className={cn(
          "rounded-[5px] px-2 py-1 font-medium transition-colors",
          value === "+"
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        {labels.positive}
      </button>
      <button
        type="button"
        onClick={() => onChange("-")}
        aria-pressed={value === "-"}
        className={cn(
          "rounded-[5px] px-2 py-1 font-medium transition-colors",
          value === "-"
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        {labels.negative}
      </button>
    </div>
  );
}

function VendorInput({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder: string;
}) {
  // No options → plain input. Autocomplete with an empty list works but it
  // noisily renders an empty popup on focus.
  if (options.length === 0) {
    return (
      <input
        name="vendor"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-md bg-background px-2 py-1.5 text-sm ring-1 ring-border outline-none focus:ring-ring"
      />
    );
  }
  return (
    <Autocomplete.Root
      items={options}
      value={value}
      onValueChange={(next) => onChange(next)}
      openOnInputClick
    >
      <Autocomplete.Input
        name="vendor"
        placeholder={placeholder}
        className="w-full rounded-md bg-background px-2 py-1.5 text-sm ring-1 ring-border outline-none focus:ring-ring"
      />
      <Autocomplete.Portal>
        <Autocomplete.Positioner sideOffset={4} className="z-[60] outline-none">
          <Autocomplete.Popup className="max-h-56 overflow-auto rounded-md bg-card p-1 text-sm shadow-md ring-1 ring-border outline-none">
            <Autocomplete.Empty className="px-2 py-1.5 text-xs text-muted-foreground">
              No matches — type a new vendor.
            </Autocomplete.Empty>
            <Autocomplete.List>
              {(item: string) => (
                <Autocomplete.Item
                  key={item}
                  value={item}
                  className="cursor-pointer rounded-sm px-2 py-1.5 text-sm data-[highlighted]:bg-muted"
                >
                  {item}
                </Autocomplete.Item>
              )}
            </Autocomplete.List>
          </Autocomplete.Popup>
        </Autocomplete.Positioner>
      </Autocomplete.Portal>
    </Autocomplete.Root>
  );
}

function CategoryPicker({
  categories,
  selectedId,
  onChange,
}: {
  categories: Category[];
  selectedId: string | undefined;
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selected = selectedId ? categories.find((c) => c.id === selectedId) : undefined;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return KIND_ORDER.map((kind) => ({
      kind,
      label: KIND_LABELS[kind],
      items: categories.filter(
        (c) =>
          c.kind === kind &&
          (q === "" || c.name.toLowerCase().includes(q) || c.emoji.includes(q)),
      ),
    })).filter((g) => g.items.length > 0);
  }, [categories, query]);

  return (
    <div className="space-y-1">
      <span className="block text-xs font-medium text-muted-foreground">Category</span>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between rounded-md bg-background px-2 py-1.5 text-left text-sm ring-1 ring-border outline-none focus:ring-ring"
      >
        {selected ? (
          <span className="flex items-center gap-2">
            <span className="text-base leading-none">{selected.emoji}</span>
            <span>{selected.name}</span>
            <span className="text-xs text-muted-foreground">· {KIND_LABELS[selected.kind]}</span>
          </span>
        ) : (
          <span className="text-muted-foreground">Pick a category…</span>
        )}
        <ChevronDown className="size-4 text-muted-foreground" aria-hidden />
      </button>

      {open && (
        <div className="rounded-md bg-card p-2 ring-1 ring-border">
          <div className="mb-2 flex items-center gap-2 rounded-md bg-background px-2 py-1 ring-1 ring-border">
            <Search className="size-3.5 text-muted-foreground" aria-hidden />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search categories"
              autoFocus
              className="w-full bg-transparent text-sm outline-none"
            />
          </div>
          <div className="max-h-60 space-y-2 overflow-auto">
            {filtered.length === 0 && (
              <p className="px-2 py-3 text-center text-xs text-muted-foreground">
                No categories match.
              </p>
            )}
            {filtered.map((group) => (
              <div key={group.kind}>
                <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {group.label}
                </p>
                <ul>
                  {group.items.map((c) => (
                    <li key={c.id}>
                      <button
                        type="button"
                        onClick={() => {
                          onChange(c.id);
                          setOpen(false);
                          setQuery("");
                        }}
                        className={cn(
                          "flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted",
                          selectedId === c.id && "bg-muted",
                        )}
                      >
                        <span className="flex items-center gap-2">
                          <span className="text-base leading-none">{c.emoji}</span>
                          <span>{c.name}</span>
                        </span>
                        {selectedId === c.id && <Check className="size-4" aria-hidden />}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SubmitButton({
  disabled,
  label,
  pendingLabel,
}: {
  disabled: boolean;
  label: string;
  pendingLabel: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={disabled || pending}
      className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/80 disabled:opacity-50"
    >
      {pending ? pendingLabel : label}
    </button>
  );
}
