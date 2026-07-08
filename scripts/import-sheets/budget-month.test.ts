import { describe, expect, it } from "vitest";

import {
  appendPaidNote,
  daysInMonth,
  toBudgetMonthDate,
} from "./budget-month";

describe("daysInMonth", () => {
  it("knows month lengths and leap years", () => {
    expect(daysInMonth(2023, 1)).toBe(31);
    expect(daysInMonth(2023, 2)).toBe(28);
    expect(daysInMonth(2024, 2)).toBe(29); // leap year
    expect(daysInMonth(2023, 4)).toBe(30);
  });
});

describe("toBudgetMonthDate", () => {
  it("keeps the written date when it already sits in the budget month", () => {
    expect(
      toBudgetMonthDate({
        budgetYear: 2023,
        budgetMonth: 4,
        commentMonth: 4,
        commentDay: 3,
      }),
    ).toEqual({ date: "2023-04-03", coerced: false, paidNote: null });
  });

  it("dates a prior-month payment by the budget month and notes the true date", () => {
    // Mortgage paid 1/27 but budgeted for February.
    expect(
      toBudgetMonthDate({
        budgetYear: 2023,
        budgetMonth: 2,
        commentMonth: 1,
        commentDay: 27,
      }),
    ).toEqual({ date: "2023-02-27", coerced: true, paidNote: "(paid 1/27)" });
  });

  it("clamps a day that overflows the budget month and marks it coerced", () => {
    // A 1/31 line landing in a February column clamps to the 28th.
    expect(
      toBudgetMonthDate({
        budgetYear: 2023,
        budgetMonth: 2,
        commentMonth: 1,
        commentDay: 31,
      }),
    ).toEqual({ date: "2023-02-28", coerced: true, paidNote: "(paid 1/31)" });
  });

  it("pads month and day to two digits", () => {
    expect(
      toBudgetMonthDate({
        budgetYear: 2023,
        budgetMonth: 3,
        commentMonth: 3,
        commentDay: 5,
      }).date,
    ).toBe("2023-03-05");
  });
});

describe("appendPaidNote", () => {
  it("combines a note with a paid suffix", () => {
    expect(appendPaidNote("household", "(paid 1/27)")).toBe(
      "household (paid 1/27)",
    );
  });

  it("returns the suffix alone when there is no note", () => {
    expect(appendPaidNote(null, "(paid 1/27)")).toBe("(paid 1/27)");
  });

  it("returns the note alone when there is no suffix", () => {
    expect(appendPaidNote("household", null)).toBe("household");
  });

  it("returns null when both are absent", () => {
    expect(appendPaidNote(null, null)).toBeNull();
  });
});
