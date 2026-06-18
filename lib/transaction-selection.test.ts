import { describe, expect, it } from "vitest";

import { groupTransactionsByDay } from "@/lib/transaction";
import {
  allTransactionIds,
  areAllSelected,
  areSomeSelected,
  dayGroupIds,
  mostCommonVendor,
  rowIds,
  selectedTotal,
  withAdded,
  withRemoved,
  withToggled,
} from "@/lib/transaction-selection";
import type { Transaction } from "@/types/budget";

function tx(over: Partial<Transaction> & { id: string }): Transaction {
  return {
    categoryId: "c1",
    amount: 10,
    date: "2026-06-08",
    vendor: "Whole Foods",
    ...over,
  };
}

describe("withToggled", () => {
  it("adds an absent id and removes a present one", () => {
    expect([...withToggled(new Set(), "a")]).toEqual(["a"]);
    expect([...withToggled(new Set(["a", "b"]), "a")]).toEqual(["b"]);
  });

  it("returns a new set without mutating the input", () => {
    const input = new Set(["a"]);
    const next = withToggled(input, "b");
    expect(next).not.toBe(input);
    expect([...input]).toEqual(["a"]);
  });
});

describe("withAdded / withRemoved", () => {
  it("adds many idempotently (selectMany)", () => {
    expect([...withAdded(new Set(["a"]), ["a", "b", "c"])].sort()).toEqual([
      "a",
      "b",
      "c",
    ]);
  });

  it("removes many (deselectMany)", () => {
    expect([...withRemoved(new Set(["a", "b", "c"]), ["a", "c"])]).toEqual(["b"]);
  });
});

describe("areAllSelected / areSomeSelected", () => {
  it("all-selected is true only when every id is present", () => {
    expect(areAllSelected(new Set(["a", "b"]), ["a", "b"])).toBe(true);
    expect(areAllSelected(new Set(["a"]), ["a", "b"])).toBe(false);
  });

  it("empty id list is never all-selected", () => {
    expect(areAllSelected(new Set(["a"]), [])).toBe(false);
  });

  it("some-selected marks the indeterminate state", () => {
    expect(areSomeSelected(new Set(["a"]), ["a", "b"])).toBe(true);
    expect(areSomeSelected(new Set(["a", "b"]), ["a", "b"])).toBe(false);
    expect(areSomeSelected(new Set(), ["a", "b"])).toBe(false);
  });
});

describe("rowIds (streak selection)", () => {
  it("returns the single id for a single row", () => {
    const [group] = groupTransactionsByDay([tx({ id: "solo", vendor: "Target" })]);
    expect(rowIds(group.rows[0])).toEqual(["solo"]);
  });

  it("returns every underlying id for a collapsed streak", () => {
    // Three Whole Foods rows on one day collapse to a streak; selecting it
    // must select all three underlying ids.
    const [group] = groupTransactionsByDay([
      tx({ id: "a" }),
      tx({ id: "b" }),
      tx({ id: "c" }),
    ]);
    const streak = group.rows.find((r) => r.kind === "streak");
    expect(streak?.kind).toBe("streak");
    expect(rowIds(streak!).sort()).toEqual(["a", "b", "c"]);
  });
});

describe("dayGroupIds / allTransactionIds", () => {
  const groups = groupTransactionsByDay([
    tx({ id: "a", date: "2026-06-08" }),
    tx({ id: "b", date: "2026-06-08" }),
    tx({ id: "c", date: "2026-06-07", vendor: "Target" }),
  ]);

  it("a day's ids span both streak and single rows", () => {
    const jun8 = groups.find((g) => g.date === "2026-06-08")!;
    expect(dayGroupIds(jun8).sort()).toEqual(["a", "b"]);
  });

  it("top-level select-all spans every day", () => {
    expect(allTransactionIds(groups).sort()).toEqual(["a", "b", "c"]);
  });
});

describe("mostCommonVendor", () => {
  const txns = [
    tx({ id: "a", vendor: "Whole Foods" }),
    tx({ id: "b", vendor: "Whole Foods" }),
    tx({ id: "c", vendor: "Target" }),
    tx({ id: "d", vendor: "  " }),
  ];

  it("returns the most-frequent vendor in the selection", () => {
    expect(mostCommonVendor(txns, new Set(["a", "b", "c"]))).toBe("Whole Foods");
  });

  it("ignores blank vendors and unselected rows", () => {
    expect(mostCommonVendor(txns, new Set(["c", "d"]))).toBe("Target");
    expect(mostCommonVendor(txns, new Set(["d"]))).toBeUndefined();
  });
});

describe("selectedTotal", () => {
  it("nets signed amounts of selected rows (refunds reduce)", () => {
    const txns = [
      tx({ id: "a", amount: 50 }),
      tx({ id: "b", amount: -10 }),
      tx({ id: "c", amount: 200 }),
    ];
    expect(selectedTotal(txns, new Set(["a", "b"]))).toBe(40);
    expect(selectedTotal(txns, new Set())).toBe(0);
  });
});
