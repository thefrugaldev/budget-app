import type { Account, InstitutionGroup, PriceLookup } from "@/types/net-worth";

import { accountValue } from "./valuation";

/**
 * Group accounts by their institution for the grouped Net Worth view (#195).
 * Each group carries its member accounts and a `subtotal` — the Σ of member
 * magnitudes via {@link accountValue}, so it reuses the one account-value
 * derivation rather than re-deriving balance-vs-holdings here.
 *
 * Accounts whose `institution` is unset (or blank, defensively — the write path
 * stores it trimmed/non-empty, but an imported or seeded doc might not) collapse
 * into a single canonical bucket keyed `null`; the UI labels it "No institution".
 *
 * Ordering: named institutions by subtotal magnitude, largest first (concentration
 * reads top-down, story 9), ties broken case-insensitively by name for a stable
 * order; the `null` bucket is always last regardless of its subtotal (story 10),
 * so a blank-institution pile never crowds out the real institutions.
 *
 * Section-agnostic by design: it groups whatever list it's given and does **not**
 * split by `class` or drop closed accounts — the caller passes one section's open
 * accounts at a time (story 11), so assets and liabilities stay separated and each
 * section's subtotals still sum to its unchanged total.
 */
export function groupAccountsByInstitution(
  accounts: Account[],
  priceFor: PriceLookup,
): InstitutionGroup[] {
  const byInstitution = new Map<string | null, Account[]>();
  for (const account of accounts) {
    const trimmed = account.institution?.trim();
    const key = trimmed ? trimmed : null;
    const bucket = byInstitution.get(key);
    if (bucket) bucket.push(account);
    else byInstitution.set(key, [account]);
  }

  const groups: InstitutionGroup[] = [];
  for (const [institution, groupAccounts] of byInstitution) {
    const subtotal = groupAccounts.reduce((sum, a) => sum + accountValue(a, priceFor), 0);
    groups.push({ institution, accounts: groupAccounts, subtotal });
  }

  return groups.sort((a, b) => {
    if (a.institution === null) return 1;
    if (b.institution === null) return -1;
    if (b.subtotal !== a.subtotal) return b.subtotal - a.subtotal;
    return a.institution.localeCompare(b.institution, "en", { sensitivity: "base" });
  });
}
