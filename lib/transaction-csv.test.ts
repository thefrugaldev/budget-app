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

  it("formats a zero amount as 0.00", () => {
    const csv = transactionsToCsv([tx({ amount: 0 })], CATEGORIES);
    expect(csv).toBe(`${HEADER}\r\n2026-06-05,Groceries,,0.00,`);
  });

  it("renders a real category named Unknown identically to the orphan fallback", () => {
    // Documents the sentinel collision: a genuine "Unknown" category and a
    // hard-deleted one both surface as `Unknown` — indistinguishable by design.
    const cats = new Map([["cat-real-unknown", "Unknown"]]);
    const csv = transactionsToCsv([tx({ categoryId: "cat-real-unknown" })], cats);
    expect(csv).toBe(`${HEADER}\r\n2026-06-05,Unknown,,42.50,`);
  });

  it("quote-wraps a field containing a bare carriage return", () => {
    const csv = transactionsToCsv([tx({ note: "line\rbreak" })], CATEGORIES);
    expect(csv).toBe(`${HEADER}\r\n2026-06-05,Groceries,,42.50,"line\rbreak"`);
  });

  it("defuses formula injection in Category/Vendor/Note, leaving Amount's sign intact", () => {
    // Leading =, +, -, @ in a text field would be evaluated as a formula by a
    // spreadsheet on open; each gets a `'` prefix. The negative Amount is a
    // real signed value, not a formula, so it stays bare.
    const cats = new Map([["c", "=danger"]]);
    const csv = transactionsToCsv(
      [tx({ categoryId: "c", vendor: "+49ers", note: "-note", amount: -5 })],
      cats,
    );
    expect(csv).toBe(`${HEADER}\r\n2026-06-05,'=danger,'+49ers,-5.00,'-note`);
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
