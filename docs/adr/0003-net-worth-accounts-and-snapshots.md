# Net worth accounts: manual entities, valuation snapshots, automatic nest egg

## Status

Accepted (2026-07-03)

## Context

Phase 3 adds a Net Worth page and a FIRE page. ADR 0001 already reserved the shape: accounts are a **distinct entity set** from the budget's categories, and savings categories never reconcile against account balances. What remained open was how account values get into the system, what "net worth over time" means when investment prices move daily, and which accounts feed the FIRE math.

## Decision

1. **Accounts are manually maintained.** An `Account` has a `class` (`asset | liability`) and, for assets, a `kind` (`cash | investment | property`). Investment accounts contain **Holdings** (`{ticker, quantity}`); cash, property, and liability accounts carry a manual balance. No bank linking, no aggregator.

2. **Investment value is quantities × live market prices.** Prices come from a `PriceProvider` interface (first implementation: Finnhub free tier, `FINNHUB_API_KEY`) with a Mongo-backed quote cache and a per-holding manual price override. The provider is a swap, not a commitment.

3. **History is deliberate valuation snapshots, not reconstruction.** Editing an account updates its live value only — *editing is not recording*. A deliberate **record** (the monthly check-in) writes a dated `Snapshot` per open account (computed value + the holdings/prices or balance behind it). Snapshots are **day-grain**: one per account per day, so re-recording the same day *replaces* it while distinct days accrue as retained history (chosen over a destructive one-per-month replace so a future finer-grained view stays possible; #109 chunk 8). The trajectory derives a month's net worth as the signed sum of each account's latest snapshot on or before month-end (carry-forward). We do **not** reconstruct past values from historical price data. The live headline (current quantities × current prices) is separate from recorded history.

4. **The FIRE nest egg is automatic: cash + investment assets.** Property and liabilities are excluded with no per-account setting. A house is not withdrawable, and debt payments already appear in monthly expenses — counting a mortgage against the nest egg would double-count it.

5. **Budget and Net Worth meet only in FIRE math.** FIRE reads trailing-12-month expense/savings averages from the budget side and the nest egg from the accounts side. Accounts never link to categories.

## Consequences

- Net-worth history is user-recorded and retained (day-grain: a same-day re-record replaces, distinct days accrue): it survives a price-provider swap, never retroactively changes from market data, and needs no time-series API. The cost: the chart has points only where the user recorded (monthly cadence in practice), and market drift between records is invisible in history.
- Adding a "House" account is safe — the `property` kind keeps it in net worth and out of the FIRE date automatically.
- All FIRE math runs in today's dollars (real growth rate = nominal return − inflation), so the FIRE number stays sanity-checkable against current spending.
- The quote cache is app-global (a price is not user data); accounts, snapshots, and FIRE assumptions are user data — relevant when auth lands.

## Considered alternatives

- **Bank/brokerage sync (Plaid etc.).** Rejected — cost, a heavy dependency, and an effective auth prerequisite, for a single-user app updated monthly by hand.
- **Ledger accounts (opening balance + transactions).** Rejected — duplicates the transaction model and cannot represent market appreciation without fabricated "growth" transactions.
- **Reconstructing history from historical prices** (store quantity changes, revalue any month at that month's closes). Rejected — needs time-series API access, and past chart values would change when the provider revises data; "what I recorded" is the honest series for a manual-entry app.
- **Per-account "counts toward FIRE" flag.** Rejected — the `kind` taxonomy answers it with zero configuration; a flag reintroduces per-account bookkeeping and default-drift.
- **Full net worth as the nest egg.** Rejected — treats home equity as withdrawable and double-counts the mortgage (subtracts from the nest egg while its payment also sits in expenses).
