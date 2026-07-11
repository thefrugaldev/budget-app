"use server";

import { revalidatePath } from "next/cache";

import { requireRole } from "@/lib/auth/require-role";
import {
  clearFireAssumptions,
  saveFireAssumptionOverrides,
} from "@/lib/repositories/fire-assumptions";

import { parseAssumptionOverrides } from "./fire-assumptions-parsers";
import type { FireAssumptionsActionState } from "./fire-assumptions-state";

function success(prev: FireAssumptionsActionState): FireAssumptionsActionState {
  return { error: null, ok: prev.ok + 1 };
}

function failure(prev: FireAssumptionsActionState, err: unknown): FireAssumptionsActionState {
  const message = err instanceof Error ? err.message : "Something went wrong";
  return { error: message, ok: prev.ok };
}

/** The FIRE page reads the resolved assumptions server-side — a save refreshes it. */
function revalidateFire(): void {
  revalidatePath("/fire");
}

/**
 * Persist the household's FIRE assumption overrides (stories 13, 15). The form
 * carries every knob; a blank field un-overrides that knob so it re-tracks its
 * data-derived default (`parseAssumptionOverrides`), and the repository stores
 * exactly the resulting set. Editor+ only — the server is the boundary (a viewer
 * may tweak the knobs locally but can't save; the UI hides the trigger).
 */
export async function saveAssumptionsAction(
  prev: FireAssumptionsActionState,
  formData: FormData,
): Promise<FireAssumptionsActionState> {
  try {
    await requireRole("editor");
    const overrides = parseAssumptionOverrides((name) => formData.get(name));
    await saveFireAssumptionOverrides(overrides);
    revalidateFire();
    return success(prev);
  } catch (err) {
    return failure(prev, err);
  }
}

/**
 * Reset every knob to its data-derived / constant default (story 16) by clearing
 * the stored overrides — resolution then falls back to the defaults. Editor+ only.
 */
export async function resetAssumptionsAction(
  prev: FireAssumptionsActionState,
): Promise<FireAssumptionsActionState> {
  try {
    await requireRole("editor");
    await clearFireAssumptions();
    revalidateFire();
    return success(prev);
  } catch (err) {
    return failure(prev, err);
  }
}
