# Harvest design language: warm no-gray palette, display+body type pairing, Lucide icons, and a token-driven identity

## Status

Accepted (2026-07-02)

## Context

The app shipped as, almost verbatim, the stock shadcn "neutral" theme (#80): every palette token was `oklch(L 0 0)` — pure grayscale — plus the default signal green/amber/red; the typeface was Geist with `--font-heading` aliased straight to `--font-sans`, so the money figures (the most characteristic content of a budgeting tool) read as plain bold body text; emoji carried the entire icon system; and there was no signature element — the dashboard was the textbook KPI-strip-over-card-grid template. For a product the owner lives in month after month, this read as generic and unmemorable.

The owner asked for a distinct identity with one justified aesthetic risk, and — just as important — for that identity to be **hard to drift away from**. Nothing recorded the design decisions, so future work would default back to shadcn. Chunk 1 of #80 prototyped three directions behind a throwaway route; the owner chose **Harvest**. This ADR records the chosen language and the mechanisms that keep the codebase on it, so chunks 2–6 are documented in one place and future work extends the identity instead of regressing.

## Decision

The identity is **Harvest** — a warm, no-gray palette organized around the sense of progress against a **Target**. It is expressed entirely through the existing `@theme inline` / `:root` / `.dark` token system in `app/globals.css`; components consume tokens and never hard-code color.

**1. Palette — warm, no gray.** Every `oklch(L 0 0)` token was replaced with warm hex values (light ground `#f1e8d7`, dark ground `#141109`; ink, card, muted, accent, border all warm). There is no neutral gray in the scheme. Chart series use identity tokens: `--chart-1` harvest gold `#c68f22`, `--chart-2` forest green `#48895c`, plus warmer ochres/oxblood for the rest.

**2. Type roles — a display face used with restraint.** Three roles, wired via `next/font`:
- **Display** — Bricolage Grotesque (`--font-display` → `--font-heading`), reserved for hero figures and key headings only. Two baked-in tiers, `text-hero` (Pulse KPI values, Category total) and `text-display` (page titles), carry their own line-height and tracking so the marquee numbers outrank titles without repeated utilities.
- **Body** — Nunito (`--font-body` → `--font-sans`), the default for everything else; data keeps `tabular-nums`.
- **Mono** — Geist Mono, retained for the rare monospace need.

Smaller headings (card totals, dialog/section titles) stay on the stock `text-*` scale — the display face is applied with restraint, not everywhere.

**3. Icons — Lucide replaces emoji.** A single coherent Lucide set (`lucide-react`) replaced emoji across `CategoryCard`, navigation, KPIs, and the Category icon picker. Icons tint via `currentColor`/tokens, so they follow the palette and render identically on every device. A pure mapping (`lib/category/icon.ts`, `iconCatalog.ts`) resolves every seed/known category id to an icon so nothing renders blank; `lib/category/icon.test.ts` guards against regressions.

**4. Signature element — "Momentum" on Pulse.** `components/budget/pulse/GrowthColumns.tsx` renders a stack of trailing monthly columns — spending on the bottom, saving stacked above — with a **savings canopy trend line** joining the saved tops, climbing toward a dashed "plan" line (the month's total caps + goals). Savings is the thing that visibly grows: the canopy touches only months that actually saved (an in-progress or spend-only month gets no point, not a misleading plunge to the soil), and a "bud" marks the tip of the climb. Columns grow up from the soil line on load (`.growth-column`, curtailed by the reduced-motion layer), and each month is explorable via an accessible hover/focus tooltip whose aria-labelled hit targets expose the same figures to assistive tech (WCAG 1.4.13). The Pulse page leads with a **thesis hero** ("You kept $X {range}") and folds the Spent/Saved/rate figures into the hero and section subtotals rather than a templated KPI strip — this is the chosen "Harvest+" direction (#80 chunk 8; chunk 5 first shipped the plainer static "Harvest"/D form). It is the one bold thing; everything around it stays quiet. Chart geometry is shared (`lib/charts/scale.ts`) rather than bespoke — see [[chart_primitives_refactor]] and ADR-driven convention "Charts compose from shared primitives" in `AGENTS.md`.

**5. Signal colors reconciled into the palette.** `--signal-good/warn/bad` were re-derived as forest / amber / oxblood rather than the stock shadcn green/amber/red, so the **threshold state** reads correctly within the scheme. Each signal is a **pair**: the bare token (`--signal-bad`) is the *fill/bar* tone (sits on `--muted`), and `-foreground` (`--signal-bad-foreground`) is the *text* tone (contrast-safe on `--card`). This split is deliberate — text and fills have different contrast requirements against different grounds. `--signal-bad` intentionally equals `--destructive` in light mode (over-cap and destructive are the same oxblood by design) but they are kept as distinct tokens so one can drift without the other. Status never rests on color alone: `thresholdDescriptor` carries a text label (honoring the expense→cap-pressure vs. savings→progress meaning-flip), and the trend chart adopts that same three-tone model via `barTone` (`lib/budget/threshold.ts`) — green under/near cap, amber at cap (90–100%), red over — so Pulse, the card meter, and the trend chart can never disagree.

**6. Light/dark contract and native chrome.** `:root` and `.dark` both declare `color-scheme` (native controls follow the theme); the `viewport` export in `app/layout.tsx` mirrors `--background` as `themeColor` for mobile browser chrome. Dark-mode contrast is tuned where the palette needs it (e.g. dark ink on the lighter dark-mode oxblood, since white drops below AA; border lifted to ~3:1 on the dark ground per WCAG 1.4.11). Any new theme updates both.

**7. Tokens are the single source of truth, enforced mechanically.** `app/globals.css` is the one authorized home for raw color literals. A `lint:design` guard (`scripts/check-design-tokens.mjs`, in the spirit of `lint:cycles`/`lint:types`) fails CI on any raw color literal (hex or CSS color function) outside the token file, and on the unscoped `transition-all` utility. The rare sanctioned literal elsewhere (the `themeColor` viewport export, which must mirror `--background`) opts out per-line with a `design-lint-allow` comment stating why. The guard's scanning logic is unit-tested by fixture (`scripts/check-design-tokens.test.ts`).

## Consequences

**Positive:**

- The look is centralized: re-theming is editing `:root`/`.dark`, not sweeping components. The chunk 2–6 rollout across Transactions, Income, and Category detail was largely "tokens flow through," not per-component color work.
- Regressions back toward shadcn defaults are caught mechanically, not just by review — a raw hex or `transition-all` fails CI.
- Signal semantics are consistent everywhere because one function (`thresholdDescriptor`/`barTone`) drives meter, Pulse, and trend colors, and the fill/text tone split keeps each contrast-correct on its ground.
- The design decisions are recorded, so future surfaces (Net worth, FIRE) inherit the identity by consuming the same tokens and chart primitives.

**Negative / trade-offs:**

- The `lint:design` guard is line/regex-based, not a real CSS/JS tokenizer: it blanks comments to avoid false-matching issue refs (`#104`) and doc-comment hex, but a color literal constructed dynamically (string concatenation, template interpolation) can slip past. The escape hatch (`design-lint-allow`) is honor-system. Acceptable — the guard targets the common regression (a pasted hex, a `bg-rose-600`-era literal, a `transition-all`), not adversarial evasion.
- The guard checks raw literals and `transition-all` only; it does **not** flag Tailwind default-palette utilities (`bg-rose-600`, `text-zinc-500`). Those were removed by hand in chunk 6 and are caught by review. Extending the guard to default-palette utilities is a reasonable future addition but was left out to avoid false positives on this pass.
- Two web-font families (Bricolage Grotesque + Nunito) beyond the single Geist default. Loaded via `next/font` (self-hosted, no layout shift); the cost is deliberate — the type pairing is core to the identity.

## Considered alternatives

- **A fourth coat of shadcn neutral (tune the grays).** Rejected — the brief was explicitly a distinct identity with a point of view, not a re-tint of the default.
- **One of the AI-default looks** (cream + high-contrast serif + terracotta; near-black + acid accent; broadsheet hairline rules). Rejected as defaults rather than choices; the owner selected Harvest from prototyped artifacts (chunk 1).
- **A single configurable mega-chart** for the signature and future charts. Rejected in favor of composing small primitives from `lib/charts/scale.ts` — a config-driven `<BarChart>` bakes in bar assumptions a later line/area chart can't use. See "Charts compose from shared primitives" in `AGENTS.md`.
- **Keep signal colors as the shadcn defaults** and only change the neutrals. Rejected — default green/amber/red clash with the warm palette; reconciling them into forest/amber/oxblood keeps good/warn/over legible within the scheme.
- **Enforce the identity by review only (no lint).** Rejected — the whole point of codification is that review missed the original drift for the app's entire life; a mechanical guard is what makes the identity durable (story 11).
- **An ESLint rule instead of a standalone script.** Rejected for parity with the existing `lint:cycles`/`lint:types` standalone guards, and because the check spans `.css` as well as `.ts`/`.tsx` — a single Node script covers both uniformly and is trivially fixture-testable.
