import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { runExtract } from "./extract";
import {
  buildFixtureWorkbook,
  fixtureIncome,
  fixtureMapping,
  fixtureOverrides,
} from "./fixtures/build-fixture-workbook";

/** Lay out an archive dir: `2023.xlsx` at root, configs under `import/`. */
async function makeArchive(
  opts?: Parameters<typeof buildFixtureWorkbook>[0],
): Promise<string> {
  const dir = mkdtempSync(join(tmpdir(), "extract-"));
  const importDir = join(dir, "import");
  mkdirSync(importDir, { recursive: true });
  writeFileSync(join(dir, "2023.xlsx"), await buildFixtureWorkbook(opts));
  writeFileSync(join(importDir, "mapping.json"), JSON.stringify(fixtureMapping));
  writeFileSync(join(importDir, "overrides.json"), JSON.stringify(fixtureOverrides));
  writeFileSync(join(importDir, "income.json"), JSON.stringify(fixtureIncome));
  return dir;
}

afterEach(() => vi.restoreAllMocks());

describe("runExtract", () => {
  it("writes manifests and reports and exits 0 when everything reconciles", async () => {
    const dir = await makeArchive();
    const code = await runExtract([dir]);
    expect(code).toBe(0);

    const categories = JSON.parse(
      readFileSync(join(dir, "import/manifest/categories.json"), "utf8"),
    );
    expect(categories.categories.map((c: { name: string }) => c.name)).toContain("Groceries");

    const year = JSON.parse(readFileSync(join(dir, "import/manifest/2023.json"), "utf8"));
    expect(year.transactions.length).toBeGreaterThan(0);

    const recon = JSON.parse(
      readFileSync(join(dir, "import/reports/reconciliation.json"), "utf8"),
    );
    expect(recon.unreconciled).toBe(0);
    JSON.parse(readFileSync(join(dir, "import/reports/vendors.json"), "utf8"));
  });

  it("produces byte-identical output across runs (deterministic)", async () => {
    const dir = await makeArchive();
    await runExtract([dir]);
    const first = readFileSync(join(dir, "import/manifest/2023.json"), "utf8");
    await runExtract([dir]);
    const second = readFileSync(join(dir, "import/manifest/2023.json"), "utf8");
    expect(second).toBe(first);
  });

  it("fails the reconciliation gate (exit 1), writing reports but NOT manifests", async () => {
    const dir = await makeArchive({ includeUnreconciled: true });
    const stderr = vi.spyOn(process.stderr, "write").mockReturnValue(true);
    const code = await runExtract([dir]);
    expect(code).toBe(1);
    expect(stderr.mock.calls.join("")).toMatch(/reconciliation gate/);
    // The diagnostic report is written; a partial manifest is NOT persisted.
    expect(existsSync(join(dir, "import/reports/reconciliation.json"))).toBe(true);
    expect(existsSync(join(dir, "import/manifest/2023.json"))).toBe(false);
    expect(existsSync(join(dir, "import/manifest/categories.json"))).toBe(false);
  });

  it("fails the payoff cross-check (exit 1), writing no manifest", async () => {
    const dir = await makeArchive({ payoffMode: "fail" });
    const stderr = vi.spyOn(process.stderr, "write").mockReturnValue(true);
    const code = await runExtract([dir]);
    expect(code).toBe(1);
    expect(stderr.mock.calls.join("")).toMatch(/payoff cross-check/);
    expect(existsSync(join(dir, "import/manifest/2023.json"))).toBe(false);
    // The reconciliation report (which now carries the cross-checks) is written.
    const recon = JSON.parse(
      readFileSync(join(dir, "import/reports/reconciliation.json"), "utf8"),
    );
    expect(recon.liabilityCrossChecksPassed).toBe(0);
  });

  it("passes the gate when the payoff quote is within tolerance", async () => {
    const dir = await makeArchive({ payoffMode: "pass" });
    expect(await runExtract([dir])).toBe(0);
    expect(existsSync(join(dir, "import/manifest/2023.json"))).toBe(true);
  });

  it("warns when an Excel lock file is present", async () => {
    const dir = await makeArchive();
    writeFileSync(join(dir, "~$2023.xlsx"), "");
    const stderr = vi.spyOn(process.stderr, "write").mockReturnValue(true);
    await runExtract([dir]);
    expect(stderr.mock.calls.join("")).toMatch(/lock file/);
  });

  it("returns usage code 2 with no archive dir", async () => {
    vi.spyOn(process.stderr, "write").mockReturnValue(true);
    expect(await runExtract([])).toBe(2);
  });

  it("honors an explicit --out directory", async () => {
    const dir = await makeArchive();
    const out = mkdtempSync(join(tmpdir(), "out-"));
    expect(await runExtract([dir, "--out", out])).toBe(0);
    expect(existsSync(join(out, "manifest/2023.json"))).toBe(true);
  });

  it("throws on an unknown flag or a --out with no value", async () => {
    const dir = await makeArchive();
    await expect(runExtract([dir, "--bogus"])).rejects.toThrow();
    await expect(runExtract([dir, "--out"])).rejects.toThrow();
  });
});
