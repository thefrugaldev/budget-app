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
 * update doesn't crater the line (story 10).
 *
 * The series is *recorded* history only: it spans the recorded snapshots and
 * never extrapolates toward today — the live headline (current prices) is the
 * separate, always-current figure (story 11). Snapshot `value` is a magnitude;
 * the owning account's `class` supplies the sign. Closed accounts keep
 * contributing their history — their closing zero-value snapshot naturally
 * zeroes them out from that month forward.
 */
export function monthlyNetWorthSeries(
  accounts: Account[],
  snapshots: Snapshot[],
): NetWorthPoint[] {
  if (snapshots.length === 0) return [];

  const classOf = new Map(accounts.map((a) => [a.id, a.class]));

  // Group snapshots per account, each list sorted ascending by date once, so the
  // per-month carry-forward is a linear walk to the latest date <= month-end.
  const byAccount = new Map<string, Snapshot[]>();
  let minDate = snapshots[0].date;
  let maxDate = snapshots[0].date;
  for (const s of snapshots) {
    const list = byAccount.get(s.accountId);
    if (list) list.push(s);
    else byAccount.set(s.accountId, [s]);
    if (s.date < minDate) minDate = s.date;
    if (s.date > maxDate) maxDate = s.date;
  }
  for (const list of byAccount.values()) {
    list.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  }

  const points: NetWorthPoint[] = [];
  for (const ym of monthsInRange(minDate.slice(0, 7), maxDate.slice(0, 7))) {
    const cutoff = monthEndDate(ym);
    let net = 0;
    for (const [accountId, list] of byAccount) {
      const accountClass = classOf.get(accountId);
      if (!accountClass) continue; // snapshot for an unknown account — ignore defensively

      let latest: Snapshot | undefined;
      for (const s of list) {
        if (s.date <= cutoff) latest = s;
        else break;
      }
      if (latest) net += signedContribution(accountClass, latest.value);
    }
    points.push({ ym, net });
  }
  return points;
}
