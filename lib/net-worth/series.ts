// Reused from the budget range module rather than re-implemented — these are
// generic "YYYY-MM" key helpers, and lib/budget/range takes no net-worth
// dependency, so there's no cycle (same cross-module-pure-helper pattern as
// lib/budget/aggregate importing lib/income/cadence).
import { monthEndDate, monthsInRange } from "@/lib/budget/range";
import type { Account, NetWorthPoint, Snapshot } from "@/types/net-worth";

import { signedContribution } from "./valuation";

/**
 * The recorded net-worth history as a dense monthly series. For every month
 * from the first recorded snapshot through the last, net worth is the signed sum
 * over accounts of each account's latest snapshot dated on or before that
 * month's end — **carry-forward** (ADR 0003): a month with no fresh snapshot for
 * an account reuses that account's most recent prior snapshot, so a skipped
 * update doesn't crater the line (story 10). The series is *recorded* history
 * only: it spans the recorded snapshots and never extrapolates toward today —
 * the live headline (current prices) is the separate, always-current figure
 * (story 11). Snapshot `value` is a magnitude; the owning account's `class`
 * supplies the sign.
 *
 * **History is defined purely over snapshots — this function does not read
 * `closedAt`** (unlike {@link netWorthHeadline} / {@link nestEgg}, which drop
 * closed accounts from the *live* view). That is deliberate and ADR-faithful:
 * "the chart plots recorded snapshots, never reconstructions." A closed
 * account's history therefore stays in the series (story 16), and it stops
 * contributing only because closing records a final `value: 0` snapshot. That
 * closing-zero-snapshot is a **write-path invariant owned by chunk 2's
 * repository layer**, not something this function can enforce: absent it, a
 * closed account would carry its last value forward. The two tests
 * "…zeroes it out from its closing snapshot" and "…without a closing snapshot,
 * carries forward" pin both sides of that contract.
 */
export function monthlyNetWorthSeries(
  accounts: Account[],
  snapshots: Snapshot[],
): NetWorthPoint[] {
  if (snapshots.length === 0) return [];

  const classOf = new Map(accounts.map((a) => [a.id, a.class]));

  // Group snapshots per account, each list sorted ascending by date once.
  const byAccount = new Map<string, Snapshot[]>();
  let minDate = snapshots[0].date;
  let maxDate = snapshots[0].date;
  for (const s of snapshots) {
    let list = byAccount.get(s.accountId);
    if (!list) byAccount.set(s.accountId, (list = []));
    list.push(s);
    if (s.date < minDate) minDate = s.date;
    if (s.date > maxDate) maxDate = s.date;
  }
  for (const list of byAccount.values()) {
    list.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  }

  // Monthly cutoffs ascend, so each account's walk advances monotonically: a
  // per-account cursor into its sorted snapshots (never rewound) plus the signed
  // value it currently carries. O((months + snapshots) · accounts) overall,
  // rather than restarting each account's walk from the head every month.
  const cursor = new Map<string, number>();
  const carried = new Map<string, number>();

  const points: NetWorthPoint[] = [];
  for (const ym of monthsInRange(minDate.slice(0, 7), maxDate.slice(0, 7))) {
    const cutoff = monthEndDate(ym);
    let net = 0;
    for (const [accountId, list] of byAccount) {
      const accountClass = classOf.get(accountId);
      if (!accountClass) continue; // snapshot for an unknown account — ignore defensively

      let i = cursor.get(accountId) ?? 0;
      while (i < list.length && list[i].date <= cutoff) {
        carried.set(accountId, signedContribution(accountClass, list[i].value));
        i++;
      }
      cursor.set(accountId, i);

      const contribution = carried.get(accountId);
      if (contribution !== undefined) net += contribution; // undefined = before its first snapshot
    }
    points.push({ ym, net });
  }
  return points;
}
