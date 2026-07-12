/**
 * FIRE domain types (#110). The **assumption set** is the single persisted input
 * to the FIRE math (there is one set, never multiple named scenarios — ADR 0003 /
 * CONTEXT "Assumption"); the projection is the pure engine's output. All math is
 * in **today's dollars**: the nest egg compounds at the real rate (nominal −
 * inflation), contributions are constant, and the FIRE number never inflates.
 */

/**
 * The user-set inputs to the FIRE math, persisted as one set with data-derived
 * defaults (chunk 3). Money fields are monthly, in today's dollars; the three
 * rate fields are **percentages** (e.g. `7` = 7%), matching the knobs the user
 * edits, and are converted to decimals inside the engine.
 */
export type FireAssumptions = {
  /** Monthly retirement spend, today's dollars. Default: trailing-12 expense avg. */
  monthlyRetirementSpend: number;
  /** Monthly contribution, today's dollars; may be 0 (the coast case). Default: trailing-12 savings avg. */
  monthlyContribution: number;
  /** Expected nominal annual return, as a percentage (default 7). */
  nominalReturn: number;
  /** Expected annual inflation, as a percentage (default 3). */
  inflation: number;
  /** Safe withdrawal rate, as a percentage (default 4). */
  safeWithdrawalRate: number;
  /** Four-digit birth year — anchors coast math and the age axis. */
  birthYear: number;
  /** Age at which coast compounding must finish the job (default 65). */
  traditionalRetirementAge: number;
};

/**
 * The subset of the assumption set a user has **explicitly overridden**, persisted
 * as one partial per household (#110 chunk 3). A knob absent here tracks its
 * data-derived default (spend/contribution from the trailing-12 budget actuals) or
 * constant default (7% / 3% / 4% / 65); resolution ({@link ResolvedAssumptions})
 * layers this over those defaults. `birthYear` has no default, so an override is
 * the *only* way it becomes set. Reset-to-defaults (story 16) clears the whole set.
 */
export type FireAssumptionOverrides = Partial<FireAssumptions>;

/**
 * The assumption set after resolution: stored overrides merged over defaults, so
 * every knob has a live value (#110 chunk 3). Identical to {@link FireAssumptions}
 * except `birthYear`, which stays **nullable** — it is the one knob with no
 * data-derived or constant default, so it reads `null` until the user sets it, and
 * the page degrades honestly (no fabricated age/coast date) rather than inventing
 * a birth year. The engine input ({@link FireAssumptions}) is built from this only
 * once `birthYear` is non-null.
 */
export type ResolvedAssumptions = Omit<FireAssumptions, "birthYear"> & {
  birthYear: number | null;
};

/**
 * What the FIRE page renders for a given resolved assumption set + nest egg
 * (#110 chunk 4) — the always-available KPIs plus the birth-year-gated horizon.
 * `realRate`, `fireNumber`, and `progress` need no birth year, so they show even
 * before one is set; `projection` (FIRE date + age, coast) is `null` until
 * `birthYear` is set, so the page prompts for it rather than fabricating an age.
 * Derived client-side per keystroke by `deriveFireView` for live recompute.
 */
export type FireView = {
  /** Derived real annual rate (nominal − inflation), decimal — shown by the return/inflation knobs (story 11). */
  realRate: number;
  /** Target nest egg (story 2); `Infinity` when the withdrawal rate is a non-positive live input. */
  fireNumber: number;
  /** Nest egg ÷ FIRE number (story 3); 0 when the target isn't a finite positive number. */
  progress: number;
  /** FIRE date/age + coast (stories 4, 5), or `null` until the birth year is set. */
  projection: FireProjection | null;
};

/**
 * A single monthly point on the FIRE projection chart (#110 chunk 5): the value
 * (nest egg in today's dollars) at a "YYYY-MM", flagged `projected` so the chart
 * renders recorded history and the projected curve as one trajectory with a
 * non-color distinction — solid recorded, dashed projected (story 17).
 */
export type ProjectionChartPoint = {
  ym: string; // "YYYY-MM"
  value: number;
  projected: boolean;
};

/**
 * Everything the projection chart draws (#110 chunk 5), derived purely by
 * `buildProjectionChart` from a resolved assumption set + nest egg + recorded
 * history — so the client recomputes it per keystroke (story 14) and it
 * unit-tests without a component. Recorded history flows into the projected
 * curve; the FIRE (and, once a birth year is set, coast) reference lines and
 * their crossings mark the projected dates (stories 17, 18).
 */
export type ProjectionChartData = {
  /** History points (`projected: false`) then projection points (`projected: true`), in time order. */
  points: ProjectionChartPoint[];
  /** Index in `points` of the first projected point (equals the recorded length); 0 when there's no history. */
  firstProjectedIndex: number;
  /** Target nest-egg reference line; `null` when it isn't a finite positive value to draw (e.g. a zero withdrawal rate). */
  fireNumber: number | null;
  /** Coast reference line; `null` until a birth year is set (it needs the retirement horizon). */
  coastNumber: number | null;
  /** The projected FIRE crossing as "YYYY-MM" (a point in `points`), or `null` if not reached within the drawn horizon. */
  fireCrossingYm: string | null;
  /** The projected coast crossing as "YYYY-MM", or `null` if not reached within the drawn horizon. */
  coastCrossingYm: string | null;
  /** Birth year for the age axis (story 18); `null` renders a year-only axis. */
  birthYear: number | null;
};

/**
 * The pure engine's output for a given assumption set + starting nest egg. Money
 * in today's dollars; `realRate` is a decimal (0.04 = 4%); dates are "YYYY-MM"
 * relative to the `today` the projection was run against. A `null` date/age means
 * the target isn't reached within the projection horizon.
 */
export type FireProjection = {
  /** Derived real annual rate (nominal − inflation), as a decimal — shown to the user (story 11). */
  realRate: number;
  /** Target nest egg: annual retirement spend ÷ safe withdrawal rate (story 2). */
  fireNumber: number;
  /** Nest egg that compounds alone to the FIRE number by the retirement age (story 5). */
  coastNumber: number;
  /** Progress toward the FIRE number (nest egg ÷ FIRE number); 0 when the target is 0. */
  progress: number;
  /** Progress toward the coast number (nest egg ÷ coast number); 0 when the target is 0. */
  coastProgress: number;
  /** Months from now until the nest egg first reaches the FIRE number; 0 if already there, null if never. */
  monthsToFire: number | null;
  /** The FIRE date as "YYYY-MM", or null if never reached within the horizon. */
  fireDate: string | null;
  /** The user's age at the FIRE date, or null if never reached. */
  fireAge: number | null;
  /** Months from now until the nest egg first reaches the coast number; 0 if already there, null if never. */
  monthsToCoast: number | null;
  /** The coast date as "YYYY-MM", or null if never reached within the horizon. */
  coastDate: string | null;
  /** The user's age at the coast date, or null if never reached. */
  coastAge: number | null;
};
