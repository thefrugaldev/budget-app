import { randomUUID } from "crypto";

import { COLLECTIONS } from "@/lib/db/collections";
import type { FireAssumptionsDocument } from "@/lib/db/documents";
import { scopedCollection } from "@/lib/db/household-scope";
import { toFireAssumptionOverrides } from "@/lib/db/mappers";
import type { FireAssumptionOverrides } from "@/types/fire";

/**
 * Persistence for the FIRE assumption set (#110 chunk 3, ADR 0003) — **one
 * document per household** holding only the knobs the user has overridden. The
 * household is the key: every operation targets the singleton via an empty
 * (household-scoped) filter, so there's no id to thread. Defaults resolution
 * (`resolveAssumptions`) and the trailing-actuals read live elsewhere — this file
 * is purely the read/write of stored overrides.
 */

// The override knobs, in document order — the single list the save path both sets
// (present knobs) and unsets (absent knobs) against, so persistence stays in lock-
// step with the type without a second place to update when a knob is added.
const OVERRIDE_KEYS = [
  "monthlyRetirementSpend",
  "monthlyContribution",
  "nominalReturn",
  "inflation",
  "safeWithdrawalRate",
  "birthYear",
  "traditionalRetirementAge",
] as const satisfies readonly (keyof FireAssumptionOverrides)[];

/** A Mongo duplicate-key error (unique-index violation) — code 11000, whatever the driver wraps it in. */
function isDuplicateKeyError(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: number }).code === 11000;
}

/** The household's stored overrides, or `null` when it has never saved any (tracks all defaults). */
export async function getFireAssumptionOverrides(): Promise<FireAssumptionOverrides | null> {
  const assumptions = await scopedCollection<FireAssumptionsDocument>(COLLECTIONS.fireAssumptions);
  const doc = await assumptions.findOne();
  return doc ? toFireAssumptionOverrides(doc) : null;
}

/**
 * Replace the household's override set with exactly `overrides`: present knobs are
 * set, absent ones are **unset** so they revert to tracking their default (an
 * omitted knob is "not overridden", not "unchanged"). Upserts the singleton by the
 * scoped household filter, so the first save creates it and later saves overwrite
 * it.
 *
 * Saving `{}` (a form with every knob blanked) persists a real document carrying
 * only `_id / householdId / updatedAt` — an "empty overrides" state that resolves
 * identically to "never saved" (`toFireAssumptionOverrides` → `{}`), but is a
 * distinct persisted row. Reset-to-defaults deliberately routes through
 * {@link clearFireAssumptions} (a true delete) rather than an empty save.
 *
 * The unique `householdId` index makes a *first* save that loses the upsert-insert
 * race throw a duplicate-key error; the winner has created the doc by then, so a
 * single retry resolves to a plain update. Single-user app, so last-write-wins on
 * the (identical-form) racing writes is correct.
 */
export async function saveFireAssumptionOverrides(
  overrides: FireAssumptionOverrides,
): Promise<void> {
  const assumptions = await scopedCollection<FireAssumptionsDocument>(COLLECTIONS.fireAssumptions);

  const set: Partial<FireAssumptionsDocument> = { updatedAt: new Date() };
  const unset: Record<string, ""> = {};
  for (const key of OVERRIDE_KEYS) {
    const value = overrides[key];
    // Cast only the dynamic write: TS can't correlate the per-key union of
    // `overrides[key]` with `set[key]` across the loop (same idiom as accounts.ts).
    if (value !== undefined) (set as Record<string, unknown>)[key] = value;
    else unset[key] = "";
  }

  const update: Record<string, unknown> = {
    $set: set,
    $setOnInsert: { _id: randomUUID() },
  };
  if (Object.keys(unset).length > 0) update.$unset = unset;

  try {
    await assumptions.updateOne({}, update, { upsert: true });
  } catch (err) {
    // Lost the first-save insert race against the unique householdId index; the
    // doc now exists, so this retry is a plain update, not an insert.
    if (!isDuplicateKeyError(err)) throw err;
    await assumptions.updateOne({}, update, { upsert: true });
  }
}

/**
 * Clear the household's stored overrides (reset-to-defaults, story 16): the whole
 * document is removed, so resolution falls back to the pure defaults. Idempotent —
 * deleting when nothing is stored is a no-op.
 */
export async function clearFireAssumptions(): Promise<void> {
  const assumptions = await scopedCollection<FireAssumptionsDocument>(COLLECTIONS.fireAssumptions);
  await assumptions.deleteOne();
}
