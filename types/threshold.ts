/**
 * Cap/goal threshold vocabulary shared by the budget helpers (which derive it)
 * and the UI (`CategoryCard`, `ThresholdMeter`, category detail) that renders
 * it. The state names are shared across kinds; their *meaning* flips by kind —
 * see the helpers in `@/lib/budget`.
 */

export type ThresholdState = "under" | "near" | "at" | "over";

export type ThresholdPalette = {
  text: string;
  bar: string;
};

export type ThresholdTone = "good" | "warn" | "bad";

/**
 * Text-bearing, color-independent description of a category's threshold state.
 * `label` is a short word/abbreviation so the signal reads without color, and
 * `tone` mirrors the palette so any color reinforcement agrees with the words.
 */
export type ThresholdDescriptor = {
  state: ThresholdState;
  label: string;
  tone: ThresholdTone;
};
