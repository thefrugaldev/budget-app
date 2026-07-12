import type { FireAssumptions, FireView, ResolvedAssumptions } from "@/types/fire";

import { computeFireProjection, fireNumber, realRate } from "./projection";

/**
 * Derive what the FIRE page shows (#110 chunk 4) from a resolved assumption set +
 * the current nest egg. Pure, so the client recomputes it per keystroke for the
 * live scenario preview (story 14) and it unit-tests without a component.
 *
 * `realRate`, `fireNumber`, and `progress` need no birth year, so they're always
 * derived. The `projection` (FIRE date + age, coast number/progress) needs the
 * birth year for the coast horizon and the age axis, so it's `null` until one is
 * set — the page then prompts for it rather than showing a fabricated age
 * (honest degradation, story 19). `today` is injectable for deterministic tests
 * and is passed a server-stable value on the page to avoid an SSR/client drift.
 */
export function deriveFireView(
  resolved: ResolvedAssumptions,
  nestEgg: number,
  today = new Date(),
): FireView {
  const r = realRate(resolved.nominalReturn, resolved.inflation);
  const fire = fireNumber(resolved.monthlyRetirementSpend, resolved.safeWithdrawalRate);
  const progress = fire > 0 && Number.isFinite(fire) ? nestEgg / fire : 0;

  if (resolved.birthYear == null) {
    return { realRate: r, fireNumber: fire, progress, projection: null };
  }
  const assumptions: FireAssumptions = { ...resolved, birthYear: resolved.birthYear };
  return {
    realRate: r,
    fireNumber: fire,
    progress,
    projection: computeFireProjection(assumptions, nestEgg, today),
  };
}
