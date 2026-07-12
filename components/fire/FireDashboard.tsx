"use client";

import { useActionState, useMemo, useState } from "react";

import {
  resetAssumptionsAction,
  saveAssumptionsAction,
} from "@/app/actions/fire-assumptions";
import { coerceNumber } from "@/app/actions/fire-assumptions-parsers";
import { FIRE_ASSUMPTIONS_ACTION_INITIAL } from "@/app/actions/fire-assumptions-state";
import { AmountInput } from "@/components/budget/amount/AmountInput";
import { NumberField } from "@/components/ui/NumberField";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { useActionSuccessToast } from "@/hooks/useActionSuccessToast";
import { useCanEdit } from "@/hooks/useCanEdit";
import { fmt } from "@/lib/budget";
import { ASSUMPTION_CONSTANT_DEFAULTS, resolveAssumptions } from "@/lib/fire/assumptions";
import { buildProjectionChart } from "@/lib/fire/chart";
import { deriveFireView } from "@/lib/fire/view";
import { cn } from "@/lib/utils";
import type { TrailingActuals } from "@/types/budget";
import type { FireAssumptionOverrides } from "@/types/fire";
import type { NetWorthPoint } from "@/types/net-worth";

import { FireKpiStrip } from "./FireKpiStrip";
import { ProjectionChart } from "./ProjectionChart";

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
  history,
  nowIso,
}: {
  nestEgg: number;
  actuals: TrailingActuals;
  stored: FireAssumptionOverrides | null;
  /** Recorded nest-egg history (cash + investment assets), for the chart's recorded segment. */
  history: NetWorthPoint[];
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
  // `coerceNumber` guards the interstitial NaN case (blank/garbage → "" not
  // "NaN"), so the hidden field never submits a literal "NaN".
  const spendEntered = coerceNumber(spend);
  const spendMonthly =
    spendEntered === undefined ? "" : String(spendEntered / (spendPeriod === "yearly" ? 12 : 1));

  // Toggling the period is a *unit* switch: keep the real (monthly) spend fixed
  // and convert the displayed figure (×12 / ÷12), so the KPIs don't lurch when
  // you flip back and forth. Reinterpreting the same digits would silently change
  // the value. Cents-rounding here can drift a few cents on a non-divisible
  // yearly figure across repeated toggles (e.g. $100,000/yr → $8,333.33/mo →
  // $99,999.96/yr) — immaterial for a planning tool; round figures round-trip exactly.
  function changeSpendPeriod(next: "monthly" | "yearly") {
    if (next === spendPeriod) return;
    const n = coerceNumber(spend);
    if (n !== undefined) {
      const converted = next === "yearly" ? n * 12 : n / 12;
      setSpend(String(Math.round(converted * 100) / 100));
    }
    setSpendPeriod(next);
  }

  const { view, chart } = useMemo(() => {
    // Same `coerceNumber` the server parser uses, so a value the preview accepts
    // is one the Save will accept too (and a rejected shape falls to the default
    // in both). A blank/invalid knob is simply "not overridden".
    const overrides: FireAssumptionOverrides = {};
    const s = coerceNumber(spendMonthly);
    if (s !== undefined) overrides.monthlyRetirementSpend = s;
    const c = coerceNumber(contribution);
    if (c !== undefined) overrides.monthlyContribution = c;
    const nr = coerceNumber(nominalReturn);
    if (nr !== undefined) overrides.nominalReturn = nr;
    const inf = coerceNumber(inflation);
    if (inf !== undefined) overrides.inflation = inf;
    const sw = coerceNumber(swr);
    if (sw !== undefined) overrides.safeWithdrawalRate = sw;
    const by = coerceNumber(birthYear);
    if (by !== undefined) overrides.birthYear = by;
    const ra = coerceNumber(retirementAge);
    if (ra !== undefined) overrides.traditionalRetirementAge = ra;
    // Resolve once, then derive both the KPIs and the chart from the same set and
    // the same server-stable "now", so they can never disagree.
    const resolved = resolveAssumptions(overrides, actuals);
    const today = new Date(nowIso);
    return {
      view: deriveFireView(resolved, nestEgg, today),
      chart: buildProjectionChart(resolved, nestEgg, history, today),
    };
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
    history,
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
                onClick={() => changeSpendPeriod(period)}
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
        <NumberField
          label="Expected return (%)"
          name="nominalReturn"
          value={nominalReturn}
          onChange={setNominalReturn}
          placeholder={String(ASSUMPTION_CONSTANT_DEFAULTS.nominalReturn)}
        />
        <NumberField
          label="Expected inflation (%)"
          name="inflation"
          value={inflation}
          onChange={setInflation}
          placeholder={String(ASSUMPTION_CONSTANT_DEFAULTS.inflation)}
          hint={realRatePct}
        />
        <NumberField
          label="Safe withdrawal rate (%)"
          name="safeWithdrawalRate"
          value={swr}
          onChange={setSwr}
          placeholder={String(ASSUMPTION_CONSTANT_DEFAULTS.safeWithdrawalRate)}
        />
        <NumberField
          label="Traditional retirement age"
          name="traditionalRetirementAge"
          value={retirementAge}
          onChange={setRetirementAge}
          placeholder={String(ASSUMPTION_CONSTANT_DEFAULTS.traditionalRetirementAge)}
          inputMode="numeric"
        />
        <NumberField
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
        <SectionHeading>Projection</SectionHeading>
        <p className="mb-3 text-xs text-muted-foreground">
          Your recorded nest egg (solid) flowing into the projected curve (dashed), in today&apos;s
          dollars. The dashed lines mark your FIRE number and, once your birth year is set, your
          coast number.
        </p>
        <ProjectionChart data={chart} />
      </section>

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
