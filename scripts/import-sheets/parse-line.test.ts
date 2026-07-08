import { describe, expect, it } from "vitest";

import { parseCommentLine } from "./parse-line";
import type { ParsedTransactionLine } from "./types";

/** Assert a line parsed as a transaction and return it narrowed. */
function tx(raw: string): ParsedTransactionLine {
  const parsed = parseCommentLine(raw);
  expect(parsed.kind).toBe("transaction");
  return parsed as ParsedTransactionLine;
}

describe("parseCommentLine — canonical shapes", () => {
  it("parses date, amount, vendor, and note", () => {
    expect(tx("4/3 - $52.10 (Costco - household)")).toEqual({
      kind: "transaction",
      month: 4,
      day: 3,
      amountCents: 5210,
      vendor: "Costco",
      note: "household",
    });
  });

  it("parses a vendor with no note", () => {
    expect(tx("12/25 - $8.99 (Spotify)")).toMatchObject({
      month: 12,
      day: 25,
      amountCents: 899,
      vendor: "Spotify",
      note: null,
    });
  });

  it("parses a line with no parens (vendor omitted)", () => {
    expect(tx("1/1 - $1,240.00")).toMatchObject({
      amountCents: 124000,
      vendor: null,
      note: null,
    });
  });

  it("handles thousands separators and 0–2 decimal places", () => {
    expect(tx("2/2 - $9,999").amountCents).toBe(999900);
    expect(tx("2/2 - $9.9").amountCents).toBe(990);
    expect(tx("2/2 - $0.05").amountCents).toBe(5);
  });

  it("splits vendor/note on the first ' - ' only", () => {
    expect(tx("3/3 - $10.00 (Amazon - books - gift)")).toMatchObject({
      vendor: "Amazon",
      note: "books - gift",
    });
  });

  it("tolerates surrounding and internal whitespace", () => {
    expect(tx("  4/3  -  $52.10   (Costco - household)  ")).toMatchObject({
      amountCents: 5210,
      vendor: "Costco",
      note: "household",
    });
  });
});

describe("parseCommentLine — refunds (negative, minus inside parens)", () => {
  it("parses (-$x) as a negative amount", () => {
    expect(tx("5/9 - (-$52.10) (Costco - return)")).toMatchObject({
      amountCents: -5210,
      vendor: "Costco",
      note: "return",
    });
  });

  it("parses a whole-dollar refund", () => {
    expect(tx("5/9 - (-$40) (Target)").amountCents).toBe(-4000);
  });

  it("rejects an unbalanced refund wrapper rather than mis-signing", () => {
    // `(-` without its close, and a stray `)` without an open, must not parse:
    // the wrapper is all-or-nothing.
    expect(parseCommentLine("5/9 - (-$40 (Target)").kind).toBe("unparsed");
    expect(parseCommentLine("5/9 - $40) (Target)").kind).toBe("unparsed");
  });
});

describe("parseCommentLine — non-transaction lines", () => {
  it("returns unparsed for a free-text note with no amount", () => {
    expect(parseCommentLine("3/3 - forgot the receipt")).toEqual({
      kind: "unparsed",
      raw: "3/3 - forgot the receipt",
    });
  });

  it("returns unparsed with no leading date", () => {
    expect(parseCommentLine("Mortgage - $1,900.00").kind).toBe("unparsed");
  });

  it("returns unparsed for an out-of-range month or day", () => {
    expect(parseCommentLine("13/1 - $5.00").kind).toBe("unparsed");
    expect(parseCommentLine("1/40 - $5.00").kind).toBe("unparsed");
  });

  it("returns unparsed for an empty line", () => {
    expect(parseCommentLine("   ").kind).toBe("unparsed");
  });

  it("returns unparsed for unparenthesized trailing junk after the amount", () => {
    expect(parseCommentLine("4/3 - $5.00 misc note").kind).toBe("unparsed");
  });
});
