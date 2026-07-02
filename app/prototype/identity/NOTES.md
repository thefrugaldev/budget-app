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
| D | **Harvest** — convergence from feedback | A's warm palette (gold / oxblood / greens + dark-brown ground) on C's rounded structure, type, and icons | Bricolage Grotesque + Nunito | Growth Columns (same as C), recolored to the Ledger palette |
| E | **Harvest+** — design-lead refinement of D | Same DNA as D; leads with a thesis hero, drops the templated KPI strip, makes savings the visible growth (canopy line), warm bg wash, grow-in motion, hover/focus polish | Bricolage Grotesque + Nunito | Growth Columns as hero: soil baseline + savings **canopy** trend line, columns grow up on load |

Data is a realistic snapshot mirroring `lib/db/seed.ts` (in `data.ts`) so the
directions are judged at true density, not in a vacuum. Read-only; no mutations.

## Verdict

**Chosen direction: E — "Harvest+"** (owner selection, 2026-07-02).

- **Chosen direction:** E (Harvest+). E is itself the end of an iteration chain:
  D grafted **A's warm palette** (gold / oxblood / greens + dark-brown ground)
  onto **C's rounded type & icons** (Bricolage Grotesque + Nunito, tinted-circle
  lucide icons); the gold was tuned to "Moderate" (`#c68f22` / `#e0b84e`) and the
  green/red lifted to match; then E refined the layout.
- **Grafts from runners-up:** none outstanding — the palette/type/icon decisions
  from A and C are already baked into D→E.
- **Rationale:** leads with a thesis hero instead of a date label; drops the
  templated KPI strip; makes savings the *visible* growth via the canopy trend
  line over the grove columns (with a grow-in load animation); and the columns
  are explorable per month via an accessible hover/focus tooltip (aria-labelled,
  Escape-dismissable). Warm background wash + card hover/focus polish. Reads as a
  considered, warm, "live-in-it" identity — not the shadcn default.

### For chunk 2 (encode as tokens)

- **Palette** (from `DirectionHarvestPlus` / `DirectionHarvest`): bg `#f1e8d7`
  light / `#141109` dark (with a subtle top wash); surface `#fffdf7` / `#211d15`;
  ink `#221e17` / `#efe7d8`; gold(warn) `#c68f22` / `#e0b84e`; good `#48895c` /
  `#86b590`; bad `#a8443f` / `#db7d75`; muted-gold accent `#9a7b3f` / `#cba965`.
- **Type:** `--font-heading` → Bricolage Grotesque (display, hero figures +
  headings); body → Nunito. Keep `tabular-nums` on figures.
- **Icons:** lucide, tinted via tokens, in soft circles (see the seed-category
  mapping in `data.ts`).
- **Signature:** the grove columns — savings as a canopy trend line climbing over
  spend toward the plan line — is the element to build on Pulse (issue #80
  chunk 5).
- Re-check `--hp-muted` text contrast against the warm ground for 4.5:1 when
  finalizing, and promote cards to semantic `<a>` with real focus states.
