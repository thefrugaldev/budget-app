// PROTOTYPE — throwaway. Delete when #80 chunk 1 has a chosen direction.
//
// Loads the candidate display/body/numeral faces for the three identity
// directions via next/font/google (self-hosted, no runtime CDN). Each face is
// exposed as a CSS variable; `fontVars` applies all of them so a direction's
// scoped stylesheet can reference whichever it needs. The winning direction's
// faces get wired into the real token system in chunk 2 — this file does not
// survive.

import {
  Fraunces,
  Inter,
  Space_Grotesk,
  JetBrains_Mono,
  Bricolage_Grotesque,
  Nunito,
} from "next/font/google";

// Direction A — Ledger: high-contrast optical serif for hero figures + a clean
// grotesque for body.
const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--proto-font-serif",
  axes: ["opsz", "SOFT"],
});
const inter = Inter({ subsets: ["latin"], variable: "--proto-font-clean" });

// Direction B — Signal: techy display + monospace numerals.
const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--proto-font-tech",
});
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--proto-font-mono",
});

// Direction C — Grove: characterful rounded display + soft humanist body.
const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--proto-font-soft-display",
});
const nunito = Nunito({ subsets: ["latin"], variable: "--proto-font-soft-body" });

/** Every face's CSS variable, applied on each direction's root element. */
export const fontVars = [
  fraunces.variable,
  inter.variable,
  spaceGrotesk.variable,
  jetbrainsMono.variable,
  bricolage.variable,
  nunito.variable,
].join(" ");
