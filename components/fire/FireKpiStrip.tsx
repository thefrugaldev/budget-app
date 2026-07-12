import { fmt, monthLabel } from "@/lib/budget";
import { cn } from "@/lib/utils";
import type { FireView } from "@/types/fire";

/** Fraction (0.42) → "42%"; one decimal below 10% so early progress isn't a bare "0%". */
function pct(fraction: number): string {
  return `${(fraction * 100).toFixed(fraction > 0 && fraction < 0.1 ? 1 : 0)}%`;
}

const CARD = "rounded-lg bg-card p-4 ring-1 ring-border";
const CARD_LABEL = "text-xs font-semibold uppercase tracking-wide text-muted-foreground";
const CARD_VALUE = "mt-1 text-xl font-semibold tabular-nums"; // stock face — display face is reserved for the hero
const CARD_SUB = "mt-0.5 text-sm text-muted-foreground tabular-nums";

/**
 * The FIRE KPI strip (#110 chunk 4, stories 1–5). Hero is progress toward the
 * FIRE number — the at-a-glance "how far along am I" — over the concrete nest
 * egg / target line. The FIRE-date and coast cards need the birth year, so they
 * prompt for it (rather than fabricate an age) until `view.projection` exists,
 * and read "Not on track yet" when the target isn't reached within the horizon.
 * Presentational only; the client dashboard recomputes `view` live.
 */
export function FireKpiStrip({ nestEgg, view }: { nestEgg: number; view: FireView }) {
  const { projection } = view;
  const fireNumberLabel = Number.isFinite(view.fireNumber) ? fmt(view.fireNumber) : "—";
  const needsBirthYear = projection === null;

  return (
    <div>
      <header className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          FIRE
        </p>
        <p className="mt-2 font-heading text-hero font-bold tracking-tight tabular-nums text-signal-good-foreground">
          {pct(view.progress)}
        </p>
        <p className="mt-3 text-base text-muted-foreground">
          <span className="font-semibold tabular-nums text-foreground">{fmt(nestEgg)}</span> of your{" "}
          <span className="font-semibold tabular-nums text-foreground">{fireNumberLabel}</span> FIRE
          number
        </p>
      </header>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className={CARD}>
          <p className={CARD_LABEL}>FIRE date</p>
          {needsBirthYear ? (
            <p className={cn(CARD_VALUE, "text-base font-normal text-muted-foreground")}>
              Add your birth year below
            </p>
          ) : projection.fireDate === null ? (
            <>
              <p className={CARD_VALUE}>Not on track yet</p>
              <p className={CARD_SUB}>Raise contributions or lower spend to reach it</p>
            </>
          ) : (
            <>
              <p className={CARD_VALUE}>{monthLabel(projection.fireDate)}</p>
              <p className={CARD_SUB}>at age {projection.fireAge}</p>
            </>
          )}
        </div>

        <div className={CARD}>
          <p className={CARD_LABEL}>Coast number</p>
          {needsBirthYear ? (
            <p className={cn(CARD_VALUE, "text-base font-normal text-muted-foreground")}>
              Add your birth year below
            </p>
          ) : (
            <>
              <p className={CARD_VALUE}>
                {Number.isFinite(projection.coastNumber) ? fmt(projection.coastNumber) : "—"}
              </p>
              <p className={CARD_SUB}>{pct(projection.coastProgress)} of the way there</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
