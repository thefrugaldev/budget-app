import { describe, expect, it } from "vitest";

import { buildFixtureWorkbook } from "./fixtures/build-fixture-workbook";
import { readWorkbookBuffer } from "./workbook";

describe("readWorkbook", () => {
  it("reads the year, grid rows, cell values, comments, estimates, and liabilities", async () => {
    const buf = await buildFixtureWorkbook();
    const wb = await readWorkbookBuffer(buf, "2023.xlsx");

    expect(wb.year).toBe(2023);
    expect(wb.gridSheet).toBe("2023");

    const groceries = wb.gridRows.find((r) => r.label === "Groceries")!;
    const jan = groceries.cells.find((c) => c.month === 1)!;
    expect(jan.cell).toBe("B2");
    expect(jan.valueCents).toBe(15210);
    expect(jan.comment).toContain("Costco");

    // Header month columns are matched by name, and the computed "Yearly"
    // column (N) is excluded — only 12 month cells per row.
    expect(groceries.cells).toHaveLength(12);

    const brokerageJan = wb.gridRows
      .find((r) => r.label === "Brokerage")!
      .cells.find((c) => c.month === 1)!;
    expect(brokerageJan.valueCents).toBe(50000);
    expect(brokerageJan.comment).toBeNull();

    expect(wb.estimates).toContainEqual({ label: "Groceries", cell: "B2", monthlyCents: 15000 });

    expect(wb.liabilities).toContainEqual({
      liability: "Mortgage",
      month: 1,
      cell: "B2",
      balanceCents: 30000000,
    });
    // Reading stops at "Total Debts", so neither it nor the "Equity" column
    // to its right is treated as a liability.
    expect(wb.liabilities.every((l) => l.liability === "Mortgage")).toBe(true);
    expect(wb.liabilities.some((l) => l.liability === "Equity")).toBe(false);
  });

  it("throws when there is no year-grid sheet", async () => {
    const { default: ExcelJS } = await import("exceljs");
    const wb = new ExcelJS.Workbook();
    wb.addWorksheet("Estimate");
    const buf = (await wb.xlsx.writeBuffer()) as unknown as Buffer;
    await expect(readWorkbookBuffer(buf, "bad.xlsx")).rejects.toThrow(/year-grid/);
  });
});
