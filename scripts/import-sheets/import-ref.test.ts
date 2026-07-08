import { describe, expect, it } from "vitest";

import { buildImportRef, hashImportRef, importRefId } from "./import-ref";

describe("buildImportRef", () => {
  it("formats the four source coordinates", () => {
    expect(
      buildImportRef({ file: "2023.xlsx", sheet: "2023", cell: "D14", line: 3 }),
    ).toBe("2023.xlsx!2023!D14#3");
  });

  it("uses line 1 for a cell-level document", () => {
    expect(
      buildImportRef({
        file: "2023.xlsx",
        sheet: "DebtsEquity",
        cell: "B5",
        line: 1,
      }),
    ).toBe("2023.xlsx!DebtsEquity!B5#1");
  });
});

describe("hashImportRef", () => {
  it("is deterministic for the same ref", () => {
    const ref = "2023.xlsx!2023!D14#3";
    expect(hashImportRef(ref)).toBe(hashImportRef(ref));
  });

  it("differs for different refs (distinct source lines get distinct ids)", () => {
    expect(hashImportRef("2023.xlsx!2023!D14#3")).not.toBe(
      hashImportRef("2023.xlsx!2023!D14#4"),
    );
  });

  it("is a 32-char hex string", () => {
    expect(hashImportRef("2023.xlsx!2023!D14#3")).toMatch(/^[0-9a-f]{32}$/);
  });
});

describe("importRefId", () => {
  it("equals hashing the built ref", () => {
    const parts = { file: "2023.xlsx", sheet: "2023", cell: "D14", line: 3 };
    expect(importRefId(parts)).toBe(hashImportRef(buildImportRef(parts)));
  });
});
