// PROTOTYPE — throwaway. Identity exploration for #80 chunk 1.
//
// Three radically different visual identities for the app, each a *complete*
// token system (palette, type pairing, icon treatment, and a signature
// element), rendered over a realistic Pulse dashboard so they're judged at true
// density. Switch between them with the floating bar or ← / → keys:
//
//     /prototype/identity            (Ledger)
//     /prototype/identity?variant=b  (Signal)
//     /prototype/identity?variant=c  (Grove)
//
// No production code is touched. The owner picks one; chunks 2+ implement it and
// this whole folder is deleted. See NOTES.md for the question and the verdict.

import type { Metadata } from "next";
import { Suspense } from "react";

import { DirectionLedger } from "./DirectionLedger";
import { DirectionSignal } from "./DirectionSignal";
import { DirectionGrove } from "./DirectionGrove";
import { DirectionHarvest } from "./DirectionHarvest";
import { DirectionHarvestPlus } from "./DirectionHarvestPlus";
import { PrototypeSwitcher } from "./PrototypeSwitcher";

export const metadata: Metadata = {
  title: "Identity prototype",
  robots: { index: false, follow: false },
};

const VARIANTS: Record<string, { meta: { key: string; name: string }; Component: () => React.ReactNode }> = {
  a: { meta: { key: "a", name: "Ledger · editorial serif" }, Component: DirectionLedger },
  b: { meta: { key: "b", name: "Signal · dark terminal" }, Component: DirectionSignal },
  c: { meta: { key: "c", name: "Grove · warm organic" }, Component: DirectionGrove },
  d: { meta: { key: "d", name: "Harvest · A's palette + C's type/icons" }, Component: DirectionHarvest },
  e: { meta: { key: "e", name: "Harvest+ · design-lead refinement of D" }, Component: DirectionHarvestPlus },
};

const ORDER = [VARIANTS.a.meta, VARIANTS.b.meta, VARIANTS.c.meta, VARIANTS.d.meta, VARIANTS.e.meta];

export default async function IdentityPrototypePage({
  searchParams,
}: {
  searchParams: Promise<{ variant?: string | string[] }>;
}) {
  const { variant } = await searchParams;
  const raw = Array.isArray(variant) ? variant[0] : variant;
  const key = raw && raw in VARIANTS ? raw : "a";
  const { Component } = VARIANTS[key];

  return (
    <>
      <Component />
      <Suspense fallback={null}>
        <PrototypeSwitcher variants={ORDER} current={key} />
      </Suspense>
    </>
  );
}
