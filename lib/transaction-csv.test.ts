import { describe, expect, it } from "vitest";

import type { Transaction } from "@/types/budget";

import { transactionsToCsv } from "./transaction-csv";

const CATEGORIES = new Map([
  ["cat-groceries", "Groceries"],
  ["cat-savings", "Emergency fund"],
]);

function tx(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: "t1",
    categoryId: "cat-groceries",
    amount: 42.5,
    date: "2026-06-05",
    ...overrides,
  };
}

const HEADER = "Date,Category,Vendor,Amount,Note";

describe("transactionsToCsv", () => {
  it("emits a header-only file for an empty set", () => {
    expect(transactionsToCsv([], CATEGORIES)).toBe(HEADER);
  });

  it("serializes a transaction with the category name resolved and amount to 2dp", () => {
    const csv = transactionsToCsv(
      [tx({ vendor: "Whole Foods", note: "weekly shop" })],
      CATEGORIES,
    );
    expect(csv).toBe(
      `${HEADER}\r\n2026-06-05,Groceries,Whole Foods,42.50,weekly shop`,
    );
  });

  it("keeps a negative amount signed (refund / withdrawal)", () => {
    const csv = transactionsToCsv(
      [tx({ amount: -19.99, vendor: "Amazon", note: "returned item" })],
      CATEGORIES,
    );
    expect(csv).toBe(
      `${HEADER}\r\n2026-06-05,Groceries,Amazon,-19.99,returned item`,
    );
  });

  it("escapes commas, quotes, and newlines in a field per RFC 4180", () => {
    const csv = transactionsToCsv(
      [
        tx({
          vendor: 'Bob "The Grocer", Inc.',
          note: "line one\nline two",
        }),
      ],
      CATEGORIES,
    );
    const [, row] = csv.split("\r\n");
    // Vendor: embedded quotes doubled, whole field quoted for the comma+quote.
    // Note: quoted for the embedded newline.
    expect(row).toBe(
      '2026-06-05,Groceries,"Bob ""The Grocer"", Inc.",42.50,"line one\nline two"',
    );
  });

  it("leaves optional vendor and note blank when absent", () => {
    const csv = transactionsToCsv([tx()], CATEGORIES);
    expect(csv).toBe(`${HEADER}\r\n2026-06-05,Groceries,,42.50,`);
  });

  it("falls back to Unknown for an unresolved category id", () => {
    const csv = transactionsToCsv([tx({ categoryId: "gone" })], CATEGORIES);
    expect(csv).toBe(`${HEADER}\r\n2026-06-05,Unknown,,42.50,`);
  });

  it("preserves input order across multiple rows", () => {
    const csv = transactionsToCsv(
      [
        tx({ id: "a", date: "2026-06-05", amount: 10 }),
        tx({ id: "b", categoryId: "cat-savings", date: "2026-06-01", amount: -5 }),
      ],
      CATEGORIES,
    );
    expect(csv.split("\r\n")).toEqual([
      HEADER,
      "2026-06-05,Groceries,,10.00,",
      "2026-06-01,Emergency fund,,-5.00,",
    ]);
  });
});
