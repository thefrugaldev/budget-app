"use client";

import { Download } from "lucide-react";
import { useId, useState } from "react";

import { exportTransactionsCsvAction } from "@/app/actions/export";
import { DateRangeField } from "@/components/ui/DateRangeField";
import { Button } from "@/components/ui/button";
import { useNotify } from "@/hooks/useNotify";
import {
  RANGE_PRESETS,
  monthEndDate,
  monthStartDate,
  rangeLabel,
  resolveRange,
} from "@/lib/budget";
import type { RangePreset } from "@/types/range";

/**
 * Settings → Data export control (#81 stories 5/6/11). A range select sits
 * beside the button — "All time" (the full-copy default) plus the shared range
 * presets, and a "Custom range…" option that reveals a `DateRangeField` only
 * when chosen, so the section stays calm. The chosen scope resolves to an
 * inclusive ISO date window the server action filters on; the download itself
 * is client-only DOM plumbing (which can't live in `lib/`).
 */
type RangeChoice = "all" | RangePreset | "custom";

export function ExportControl() {
  const [pending, setPending] = useState(false);
  const [choice, setChoice] = useState<RangeChoice>("all");
  const [custom, setCustom] = useState<{ from: string; to: string }>({
    from: "",
    to: "",
  });
  const notify = useNotify();
  const rangeId = useId();
  const customId = useId();

  function selectedBounds(): { dateFrom?: string; dateTo?: string } {
    if (choice === "all") return {};
    if (choice === "custom") {
      return {
        dateFrom: custom.from || undefined,
        dateTo: custom.to || undefined,
      };
    }
    const { ymStart, ymEnd } = resolveRange(choice);
    return { dateFrom: monthStartDate(ymStart), dateTo: monthEndDate(ymEnd) };
  }

  async function handleExport() {
    setPending(true);
    try {
      const csv = await exportTransactionsCsvAction(selectedBounds());
      downloadCsv(csv, `transactions-${today()}.csv`);
    } catch (err) {
      notify.error(
        "Export failed",
        err instanceof Error ? err.message : "Could not export your transactions.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor={rangeId} className="sr-only">
          Date range to export
        </label>
        <select
          id={rangeId}
          value={choice}
          onChange={(event) => setChoice(event.target.value as RangeChoice)}
          className="rounded-md bg-background px-2 py-1.5 text-sm text-foreground ring-1 ring-border outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="all">All time</option>
          {RANGE_PRESETS.map((preset) => (
            <option key={preset} value={preset}>
              {rangeLabel(preset)}
            </option>
          ))}
          <option value="custom">Custom range…</option>
        </select>
        <Button
          type="button"
          variant="outline"
          onClick={handleExport}
          disabled={pending}
        >
          <Download data-icon="inline-start" aria-hidden />
          {pending ? "Exporting…" : "Export CSV"}
        </Button>
      </div>

      {choice === "custom" ? (
        <div>
          <label htmlFor={customId} className="sr-only">
            Custom date range
          </label>
          <DateRangeField
            id={customId}
            from={custom.from}
            to={custom.to}
            onChange={setCustom}
            placeholder="Any date"
            className="sm:max-w-xs"
          />
        </div>
      ) : null}
    </div>
  );
}

/** Local calendar date as `YYYY-MM-DD`, for a human-readable download name. */
function today(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Triggers a client-side file download of `contents` as `filename`. */
function downloadCsv(contents: string, filename: string): void {
  const blob = new Blob([contents], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
