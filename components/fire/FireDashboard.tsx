"use client";

import { useActionState, useMemo, useState } from "react";

import {
  resetAssumptionsAction,
  saveAssumptionsAction,
} from "@/app/actions/fire-assumptions";
import { FIRE_ASSUMPTIONS_ACTION_INITIAL } from "@/app/actions/fire-assumptions-state";
import { AmountInput } from "@/components/budget/amount/AmountInput";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { useActionSuccessToast } from "@/hooks/useActionSuccessToast";
import { useCanEdit } from "@/hooks/useCanEdit";
import { fmt } from "@/lib/budget";
import { ASSUMPTION_CONSTANT_DEFAULTS, resolveAssumptions } from "@/lib/fire/assumptions";
import { deriveFireView } from "@/lib/fire/view";
import { cn } from "@/lib/utils";
import type { TrailingActuals } from "@/types/budget";
import type { FireAssumptionOverrides } from "@/types/fire";

import { FireKpiStrip } from "./FireKpiStrip";
import { NumberKnob } from "./NumberKnob";

/** A raw field string → a number override, or `undefined` when blank/invalid (falls back to the default). */
function toNum(raw: string): number | undefined {
  const n = Number(raw);
  return raw.trim() !== "" && Number.isFinite(n) ? n : undefined;
}

const str = (n: number | undefined): string => (n != null ? String(n) : "");

/**
 * The interactive FIRE dashboard (#110 chunk 4): a client component holding the
 * editable knobs, recomputing the KPIs live per keystroke over server-fetched
 * inputs (story 14), and persisting an explicit Save. Knobs pre-fill from the
 * stored overrides and show each default as a placeholder — a blank field stays
 * "not overridden" so it keeps tracking the data (matching the chunk-3 parser).
 * Viewers keep the knobs interactive for local what-ifs but get no Save/Reset
 * (the server rejects a viewer save regardless); editors get both.
 */
export function FireDashboard({
  nestEgg,
  actuals,
  stored,
  nowIso,
}: {
  nestEgg: number;
  actuals: TrailingActuals;
  stored: FireAssumptionOverrides | null;
  /** Server-stable "now" (ISO) — anchors the projection identically on SSR and client. */
  nowIso: string;
}) {
  const canEdit = useCanEdit();

  const [spend, setSpend] = useState(str(stored?.monthlyRetirementSpend));
  const [spendPeriod, setSpendPeriod] = useState<"monthly" | "yearly">("monthly");
  const [contribution, setContribution] = useState(str(stored?.monthlyContribution));
  const [nominalReturn, setNominalReturn] = useState(str(stored?.nominalReturn));
  const [inflation, setInflation] = useState(str(stored?.inflation));
  const [swr, setSwr] = useState(str(stored?.safeWithdrawalRate));
  const [birthYear, setBirthYear] = useState(str(stored?.birthYear));
  const [retirementAge, setRetirementAge] = useState(str(stored?.traditionalRetirementAge));

  // The canonical *monthly* spend the form submits and the preview uses — the
  // yearly toggle is entry-only (AmountInput carries no `name`; we emit the
  // converted value ourselves, per its documented yearly→monthly pattern).
  const spendMonthly = spend === "" ? "" : String(Number(spend) / (spendPeriod === "yearly" ? 12 : 1));

  const view = useMemo(() => {
    const overrides: FireAssumptionOverrides = {};
    const s = toNum(spendMonthly);
    if (s !== undefined) overrides.monthlyRetirementSpend = s;
    const c = toNum(contribution);
    if (c !== undefined) overrides.monthlyContribution = c;
    const nr = toNum(nominalReturn);
    if (nr !== undefined) overrides.nominalReturn = nr;
    const inf = toNum(inflation);
    if (inf !== undefined) overrides.inflation = inf;
    const sw = toNum(swr);
    if (sw !== undefined) overrides.safeWithdrawalRate = sw;
    const by = toNum(birthYear);
    if (by !== undefined) overrides.birthYear = by;
    const ra = toNum(retirementAge);
    if (ra !== undefined) overrides.traditionalRetirementAge = ra;
    return deriveFireView(resolveAssumptions(overrides, actuals), nestEgg, new Date(nowIso));
  }, [
    spendMonthly,
    contribution,
    nominalReturn,
    inflation,
    swr,
    birthYear,
    retirementAge,
    actuals,
    nestEgg,
    nowIso,
  ]);

  const [saveState, saveAction, saving] = useActionState(
    saveAssumptionsAction,
    FIRE_ASSUMPTIONS_ACTION_INITIAL,
  );
  const [resetState, resetAction, resetting] = useActionState(
    resetAssumptionsAction,
    FIRE_ASSUMPTIONS_ACTION_INITIAL,
  );

  useActionSuccessToast(saveState, () => "Assumptions saved");
  useActionSuccessToast(resetState, () => "Reset to defaults", () => {
    setSpend("");
    setSpendPeriod("monthly");
    setContribution("");
    setNominalReturn("");
    setInflation("");
    setSwr("");
    setBirthYear("");
    setRetirementAge("");
  });

  const realRatePct = `Real return ≈ ${(view.realRate * 100).toFixed(1)}% (return − inflation)`;

  const knobs = (
    <div className="space-y-4">
      <div>
        <div className="flex items-baseline justify-between gap-3">
          <label htmlFor="fire-spend" className="block text-xs font-medium text-muted-foreground">
            Retirement spend
          </label>
          <div className="flex rounded-md ring-1 ring-border" role="group" aria-label="Spend period">
            {(["monthly", "yearly"] as const).map((period) => (
              <button
                key={period}
                type="button"
                aria-pressed={spendPeriod === period}
                onClick={() => setSpendPeriod(period)}
                className={cn(
                  "rounded-md px-2 py-1 text-xs font-medium capitalize transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  spendPeriod === period
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {period}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-1">
          <AmountInput
            id="fire-spend"
            value={spend}
            onChange={setSpend}
            precision="cents"
            ariaLabel={`Retirement spend (${spendPeriod})`}
            placeholder={fmt(actuals.monthlyExpense)}
          />
        </div>
        <input type="hidden" name="monthlyRetirementSpend" value={spendMonthly} />
      </div>

      <div>
        <label
          htmlFor="fire-contribution"
          className="block text-xs font-medium text-muted-foreground"
        >
          Monthly contribution
        </label>
        <div className="mt-1">
          <AmountInput
            id="fire-contribution"
            name="monthlyContribution"
            value={contribution}
            onChange={setContribution}
            precision="cents"
            allowZero
            ariaLabel="Monthly contribution"
            placeholder={fmt(actuals.monthlySavings)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <NumberKnob
          label="Expected return (%)"
          name="nominalReturn"
          value={nominalReturn}
          onChange={setNominalReturn}
          placeholder={String(ASSUMPTION_CONSTANT_DEFAULTS.nominalReturn)}
        />
        <NumberKnob
          label="Expected inflation (%)"
          name="inflation"
          value={inflation}
          onChange={setInflation}
          placeholder={String(ASSUMPTION_CONSTANT_DEFAULTS.inflation)}
          hint={realRatePct}
        />
        <NumberKnob
          label="Safe withdrawal rate (%)"
          name="safeWithdrawalRate"
          value={swr}
          onChange={setSwr}
          placeholder={String(ASSUMPTION_CONSTANT_DEFAULTS.safeWithdrawalRate)}
        />
        <NumberKnob
          label="Traditional retirement age"
          name="traditionalRetirementAge"
          value={retirementAge}
          onChange={setRetirementAge}
          placeholder={String(ASSUMPTION_CONSTANT_DEFAULTS.traditionalRetirementAge)}
          inputMode="numeric"
        />
        <NumberKnob
          label="Birth year"
          name="birthYear"
          value={birthYear}
          onChange={setBirthYear}
          placeholder="e.g. 1990"
          hint="Needed for your FIRE date and coast number"
          inputMode="numeric"
        />
      </div>
    </div>
  );

  return (
    <div className="space-y-8">
      <FireKpiStrip nestEgg={nestEgg} view={view} />

      <section>
        <SectionHeading>Assumptions</SectionHeading>
        {canEdit ? (
          <>
            <form action={saveAction}>
              {knobs}
              {saveState.error && (
                <p className="mt-4 text-sm text-signal-bad-foreground">{saveState.error}</p>
              )}
              <div className="mt-5 flex items-center gap-3">
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
                >
                  {saving ? "Saving…" : "Save assumptions"}
                </button>
              </div>
            </form>
            <form action={resetAction} className="mt-3">
              <button
                type="submit"
                disabled={resetting}
                className="text-sm font-medium text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
              >
                {resetting ? "Resetting…" : "Reset to defaults"}
              </button>
            </form>
          </>
        ) : (
          <div>
            {knobs}
            <p className="mt-4 text-xs italic text-muted-foreground">
              Viewers can explore scenarios here, but only editors can save them.
            </p>
          </div>
        )}
        <p className="mt-6 text-xs text-muted-foreground">
          Spend and savings figures are gross (pre-tax), the same basis as the savings rate on
          Pulse — treat the projection as a planning estimate, not an after-tax guarantee.
        </p>
      </section>
    </div>
  );
}
