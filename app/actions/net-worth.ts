"use server";

import { revalidatePath } from "next/cache";

import { requireRole } from "@/lib/auth/require-role";
import {
  buildCheckInSnapshots,
  tickersNeedingQuotes,
  unpricedTickers,
} from "@/lib/net-worth/check-in";
import { getQuotes } from "@/lib/net-worth/price/get-quotes";
import { searchTickers } from "@/lib/net-worth/price/search-tickers";
import {
  addHolding,
  closeAccount,
  createAccount,
  deleteAccount,
  getAccountById,
  listAccounts,
  removeHolding,
  updateAccount,
  updateHolding,
} from "@/lib/repositories/accounts";
import { createSnapshots } from "@/lib/repositories/snapshots";
import type { Account, Holding, PriceLookup, TickerSearchResult } from "@/types/net-worth";

import {
  parseAccountClass,
  parseAccountId,
  parseAccountName,
  parseAssetKind,
  parseBalanceAmount,
  parseCheckInDate,
  parseInstitution,
  parsePriceOverride,
  parseQuantity,
  parseTicker,
} from "./net-worth-parsers";
import type { NetWorthActionState } from "./net-worth-state";

// Derived from the repository's signature rather than importing the named types:
// `AccountPatch` (with its `$unset` clear-flags) and `UpdateAccountResult` are
// the repository's own persistence-flavored API contract and stay co-located
// with it — this single caller reads them off the function, the same idiom the
// codebase uses for hook return types (`ReturnType<typeof useNotify>`).
type AccountPatch = Parameters<typeof updateAccount>[1];
type UpdateAccountResult = Awaited<ReturnType<typeof updateAccount>>;

function success(prev: NetWorthActionState, id?: string): NetWorthActionState {
  return { error: null, ok: prev.ok + 1, id };
}

function failure(prev: NetWorthActionState, err: unknown): NetWorthActionState {
  const message = err instanceof Error ? err.message : "Something went wrong";
  return { error: message, ok: prev.ok };
}

/** The Net Worth page is one self-contained surface — every mutation refreshes it. */
function revalidateNetWorth(): void {
  revalidatePath("/net-worth");
}

/**
 * Today as a UTC ISO date — the **last-resort fallback** when no date is passed.
 * A live check-in should record against the user's *local* calendar day, which
 * the server can't know; the caller (chunk 8's edit mode) passes the client's
 * local date via `input.date` and this fallback only covers a caller that omits
 * it. UTC here would misfile a late-evening check-in in a behind-UTC timezone as
 * tomorrow — hence the caller-supplied date is the real path.
 */
function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Translate the repository's discriminated update result into an action outcome.
 * `no-change` is a benign idempotent save (the dialog submitted unchanged
 * values) — not an error. `class-locked` and `not-found` surface inline.
 */
function assertUpdated(result: UpdateAccountResult): void {
  if (result.ok || result.reason === "no-change") return;
  if (result.reason === "not-found") throw new Error("Account not found");
  throw new Error(
    "Can't change an account's class once it has recorded history — close it and create a new one.",
  );
}

async function requireInvestmentAccount(id: string): Promise<Account> {
  const account = await getAccountById(id);
  if (!account) throw new Error("Account not found");
  if (account.kind !== "investment") {
    throw new Error("Holdings can only be edited on an investment account");
  }
  return account;
}

/**
 * Create an account (story 3). A liability or a cash/property asset carries a
 * starting `balance`; an investment account is created empty and gains holdings
 * via {@link addHoldingAction} (story 4). The resulting shape is re-validated in
 * the repository (asset needs a kind, liability forbids one).
 */
export async function createAccountAction(
  prev: NetWorthActionState,
  formData: FormData,
): Promise<NetWorthActionState> {
  try {
    await requireRole("editor");
    const name = parseAccountName(formData.get("name"));
    const accountClass = parseAccountClass(formData.get("class"));
    // Optional on every account; `createAccount` writes it only when defined, so
    // a blank field (→ undefined) simply creates the account without one (#195).
    const institution = parseInstitution(formData.get("institution"));

    let account: Account;
    if (accountClass === "liability") {
      const balance = parseBalanceAmount(formData.get("balance"));
      account = await createAccount({ name, class: "liability", balance, institution });
    } else {
      const kind = parseAssetKind(formData.get("kind"));
      account =
        kind === "investment"
          ? await createAccount({ name, class: "asset", kind, institution })
          : await createAccount({
              name,
              class: "asset",
              kind,
              balance: parseBalanceAmount(formData.get("balance")),
              institution,
            });
    }

    revalidateNetWorth();
    return success(prev, account.id);
  } catch (err) {
    return failure(prev, err);
  }
}

/**
 * Edit an account's name / class / kind / balance (story 15). The dialog submits
 * the full desired shape; we translate it into the patch — clearing the fields
 * the target shape doesn't use (a liability has no kind, an investment carries no
 * manual balance) so a corrected account never keeps stale data. `class` is
 * immutable once history exists — the repository enforces that and we surface it.
 */
export async function updateAccountAction(
  prev: NetWorthActionState,
  formData: FormData,
): Promise<NetWorthActionState> {
  try {
    await requireRole("editor");
    const id = parseAccountId(formData.get("id"));
    const name = parseAccountName(formData.get("name"));
    const accountClass = parseAccountClass(formData.get("class"));

    const patch: AccountPatch = { name, class: accountClass };
    // Institution is orthogonal to class (both asset and liability carry it). A
    // blanked field parses to `undefined` → clear it via `$unset` rather than
    // writing an empty string, so a cleared value round-trips to "no institution"
    // instead of silently leaving the old one (#195).
    const institution = parseInstitution(formData.get("institution"));
    if (institution === undefined) patch.clearInstitution = true;
    else patch.institution = institution;

    if (accountClass === "liability") {
      // Liabilities are manual-balance with no kind or holdings.
      patch.clearKind = true;
      patch.clearHoldings = true;
      patch.balance = parseBalanceAmount(formData.get("balance"));
    } else {
      const kind = parseAssetKind(formData.get("kind"));
      patch.kind = kind;
      if (kind === "investment") {
        // Investment value comes from holdings (edited separately), not a balance.
        patch.clearBalance = true;
      } else {
        patch.clearHoldings = true;
        patch.balance = parseBalanceAmount(formData.get("balance"));
      }
    }

    assertUpdated(await updateAccount(id, patch));
    revalidateNetWorth();
    return success(prev, id);
  } catch (err) {
    return failure(prev, err);
  }
}

/**
 * Close an account (story 16): the repository records a final `value: 0` snapshot
 * and marks it closed, so it leaves the headline/check-in but keeps its history.
 * Idempotent in the repo — a second close is a no-op — which we report as "not
 * found or already closed" rather than a silent success.
 */
export async function closeAccountAction(
  prev: NetWorthActionState,
  formData: FormData,
): Promise<NetWorthActionState> {
  try {
    await requireRole("editor");
    const id = parseAccountId(formData.get("id"));
    const date = parseCheckInDate(formData.get("date")) ?? todayIso();
    const closed = await closeAccount(id, date);
    if (!closed) throw new Error("Account not found or already closed");
    revalidateNetWorth();
    return success(prev, id);
  } catch (err) {
    return failure(prev, err);
  }
}

/**
 * Hard-delete an account (story 15/16) — only when it has no recorded history;
 * an account with snapshots is closed, never deleted, so the trajectory keeps its
 * past. The repository refuses the delete when history exists; we distinguish a
 * missing account from a has-history one for a clearer message.
 */
export async function deleteAccountAction(
  prev: NetWorthActionState,
  formData: FormData,
): Promise<NetWorthActionState> {
  try {
    await requireRole("editor");
    const id = parseAccountId(formData.get("id"));
    const account = await getAccountById(id);
    if (!account) throw new Error("Account not found");
    const deleted = await deleteAccount(id);
    if (!deleted) {
      throw new Error("Can't delete an account with recorded history — close it instead");
    }
    revalidateNetWorth();
    return success(prev);
  } catch (err) {
    return failure(prev, err);
  }
}

/**
 * Add a holding to an investment account (story 4). Rejects a duplicate ticker —
 * a symbol appears once per account, and re-adding would double-count it; edit
 * the existing position instead ({@link updateHoldingAction}).
 */
export async function addHoldingAction(
  prev: NetWorthActionState,
  formData: FormData,
): Promise<NetWorthActionState> {
  try {
    await requireRole("editor");
    const id = parseAccountId(formData.get("accountId"));
    await requireInvestmentAccount(id); // existence + kind gate (nice errors)
    const ticker = parseTicker(formData.get("ticker"));
    const quantity = parseQuantity(formData.get("quantity"));
    const priceOverride = parsePriceOverride(formData.get("priceOverride"));
    const holding: Holding = {
      ticker,
      quantity,
      ...(priceOverride !== undefined ? { priceOverride } : {}),
    };
    // Atomic push (uniqueness enforced in the write) — no read-modify-write, so a
    // concurrent add of a different ticker can't clobber this one (#140).
    const result = await addHolding(id, holding);
    if (result === "duplicate") {
      throw new Error("That ticker is already in this account — edit it instead");
    }
    if (result === "not-found") throw new Error("Account not found");
    revalidateNetWorth();
    return success(prev, id);
  } catch (err) {
    return failure(prev, err);
  }
}

/**
 * Edit a holding in place (story 18) — new quantity and/or price override,
 * keyed by ticker. Clearing the override field reverts the holding to the feed
 * price. Throws when the ticker isn't in the account.
 */
export async function updateHoldingAction(
  prev: NetWorthActionState,
  formData: FormData,
): Promise<NetWorthActionState> {
  try {
    await requireRole("editor");
    const id = parseAccountId(formData.get("accountId"));
    await requireInvestmentAccount(id); // existence + kind gate (nice errors)
    const ticker = parseTicker(formData.get("ticker"));
    const quantity = parseQuantity(formData.get("quantity"));
    const priceOverride = parsePriceOverride(formData.get("priceOverride"));
    // Atomic positional update — a concurrent edit to another holding survives (#140).
    if (!(await updateHolding(id, ticker, { quantity, priceOverride }))) {
      throw new Error("Holding not found");
    }
    revalidateNetWorth();
    return success(prev, id);
  } catch (err) {
    return failure(prev, err);
  }
}

/**
 * Remove a holding (story 18 — a sold position). Throws when the ticker isn't in
 * the account. An investment account may legitimately end up with no holdings
 * (it then values at 0 until refilled).
 */
export async function removeHoldingAction(
  prev: NetWorthActionState,
  formData: FormData,
): Promise<NetWorthActionState> {
  try {
    await requireRole("editor");
    const id = parseAccountId(formData.get("accountId"));
    await requireInvestmentAccount(id); // existence + kind gate (nice errors)
    const ticker = parseTicker(formData.get("ticker"));
    // Atomic $pull — no read-modify-write, so a concurrent edit isn't lost (#140).
    if (!(await removeHolding(id, ticker))) throw new Error("Holding not found");
    revalidateNetWorth();
    return success(prev, id);
  } catch (err) {
    return failure(prev, err);
  }
}

/**
 * Symbol-search for the add-holding combobox (#144). A query action (not a
 * form submit), called from the debounced client hook. Editor-gated — the
 * autocomplete only appears in the editor flow, and gating keeps a viewer or an
 * unauthenticated request from spending our Tiingo quota. Degrades to `[]` on
 * any failure (missing key, rate limit, outage) so type-ahead never surfaces an
 * error mid-keystroke; the user can always type the ticker by hand.
 */
export async function searchTickersAction(query: string): Promise<TickerSearchResult[]> {
  try {
    await requireRole("editor");
    return await searchTickers(query);
  } catch (err) {
    console.warn("Ticker search failed:", err);
    return [];
  }
}

/**
 * Price-check a chosen ticker (#144 chunk 2 — coverage matching). The combobox
 * suggests every search match; on *select* — not per keystroke, which would burn
 * quota — we fetch just the chosen symbol's live price so the user can eyeball it
 * before saving, or be nudged to a manual override when the feed can't quote it
 * (search and quotes are the same Tiingo provider, but not every listed symbol
 * has a current price). Editor-gated like {@link searchTickersAction}; degrades
 * to `null` — read as "no live price" — on any failure so entry never breaks.
 * Returns the per-share price in dollars, or `null` when unpriced.
 */
export async function lookupTickerPriceAction(ticker: string): Promise<number | null> {
  try {
    await requireRole("editor");
    const t = ticker.trim().toUpperCase();
    if (t === "") return null;
    const prices = await getQuotes([t]);
    return prices.get(t) ?? null;
  } catch (err) {
    console.warn("Ticker price lookup failed:", err);
    return null;
  }
}

/**
 * Submit a check-in (stories 7/8): record one dated snapshot per open account at
 * its current value — a complete monthly data point, so an untouched account
 * carries forward rather than cratering the chart. This is purely the *history*
 * write: the account values it captures are edited individually on the page
 * (the single source of truth); the check-in just stamps them. Snapshots are
 * day-grain (see `createSnapshots`), so re-recording a day replaces it.
 *
 * **Refuses rather than under-records.** If a needed ticker can't be priced (no
 * override, no cached price ever, and the feed can't quote it), the check-in is
 * rejected naming those tickers — recording them would bake a $0 undershoot into
 * history, which is never reconstructed (ADR 0003). The user adds a manual price
 * override (story 12) and retries. All-or-nothing keeps the monthly point honest.
 *
 * Fire-and-forget (typed input); `date` is the client's local day. Reports
 * `recorded` for the flow's toast. Defends its own boundary with `requireRole`.
 */
export async function submitCheckInAction(
  input: { date?: string } = {},
): Promise<{ error: string | null; recorded: number }> {
  try {
    await requireRole("editor");
    const date = parseCheckInDate(input.date) ?? todayIso();
    const openAccounts = (await listAccounts()).filter((a) => !a.closedAt);

    const tickers = tickersNeedingQuotes(openAccounts);
    const prices = tickers.length > 0 ? await getQuotes(tickers) : new Map<string, number>();

    const missing = unpricedTickers(openAccounts, prices);
    if (missing.length > 0) {
      return {
        error: `Couldn't get a live price for ${missing.join(", ")}. Add a manual price override for those holdings, then check in again.`,
        recorded: 0,
      };
    }

    const priceFor: PriceLookup = (ticker) => prices.get(ticker);
    const snapshots = buildCheckInSnapshots(openAccounts, priceFor, date);
    const recorded = await createSnapshots(snapshots);

    revalidateNetWorth();
    return { error: null, recorded };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Check-in failed", recorded: 0 };
  }
}
