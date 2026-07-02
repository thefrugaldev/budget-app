# PROTOTYPE — Identity exploration (#80 chunk 1)

**Throwaway.** Delete this whole folder once a direction is chosen and chunk 2
begins encoding it into the real token system.

## The question

> What should the app's visual identity be? The audit found it's the stock
> shadcn neutral theme — grayscale tokens, default Geist, emoji icons, a
> textbook KPI-strip-over-card-grid, and no signature element. Pick a real point
> of view that takes one justified aesthetic risk.

Each direction is a **complete token system** — palette (beyond gray + default
signals), a display + body + numeral type pairing, an icon treatment that
replaces emoji (all via `lucide-react`, palette-tintable), and a candidate
**signature element** expressing "progress against Targets over time."

## How to view

```
pnpm dev
```

Then open **/prototype/identity** and cycle with the floating bottom bar or the
**← / →** keys. Evaluate each at desktop (1440px) and mobile (390px), in **light
and dark** (the app theme toggle in Settings → Appearance drives both).

| Key | Direction | Risk | Type | Signature |
|-----|-----------|------|------|-----------|
| A | **Ledger** — editorial, warm paper | High-contrast serif on money figures; ruled ledger rows, not cards | Fraunces (display) + Inter | The Ledger Line — spend-vs-cap timeline area chart |
| B | **Signal** — dark-first instrument panel | Near-black canvas in both themes + one electric accent; mono numerals | Space Grotesk + JetBrains Mono | The Pulse Ring — twin radial gauge over an ECG rate trace |
| C | **Grove** — warm, human, organic | Clay + sage palette (no gray), rounded display face, generous radius | Bricolage Grotesque + Nunito | Growth Columns — monthly spend+savings climbing to the plan line |

Data is a realistic snapshot mirroring `lib/db/seed.ts` (in `data.ts`) so the
directions are judged at true density, not in a vacuum. Read-only; no mutations.

## Verdict

_TBD — awaiting owner selection._

- Chosen direction:
- Grafts from the runners-up (e.g. "B's ring with A's palette"):
- Rationale:
