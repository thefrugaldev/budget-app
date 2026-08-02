# Target suggestions are computed on read, not materialized

Target suggestions (system-detected proposals to change a category's cap when recent activity has sustainably diverged from it) are **derived on every page load** by a pure detector over the transactions and targets already in memory — the same data Pulse and the category page load for aggregation. Suggestions are never written to the database. The **only** persisted state is a **dismissal** row per category (the snoozed observed level), used to suppress re-nagging until the gap shifts materially further or the snooze lapses.

## Considered options

- **Materialized suggestions + cron** — a background job periodically writes `suggestion` documents with a status lifecycle (pending/accepted/dismissed/expired), i.e. a notifications inbox. Rejected for v1: it would be the codebase's first background job and first multi-month DB rollup, and it buys only an audit trail and push notifications, neither of which v1 needs.
- **Compute on read (chosen)** — matches the app's spine: everything multi-month is derived in-app from `listAllTransactions()`; there is no DB rollup and no cron anywhere. Detection is one more cheap windowing pass over data already loaded.

## Consequences

- Suggestions have no independent history — "what did it suggest last spring?" is unanswerable. Accepted suggestions live on in `CategoryTarget` history; dismissed/expired ones leave no trace beyond the current dismissal row. Accepted for v1.
- The detector must remain pure and take `now` as a parameter (consistent with `trailingActuals`/`monthlyTotalsLastN`), so the timed-snooze recheck needs no clock of its own.
- Moving to push notifications or an audit trail later means introducing the materialized model then — this ADR records that the absence of a suggestions table is deliberate, not an oversight.
