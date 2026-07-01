"use client";

import { Download } from "lucide-react";
import { useState } from "react";

import { exportTransactionsCsvAction } from "@/app/actions/export";
import { Button } from "@/components/ui/button";
import { useNotify } from "@/hooks/useNotify";

/**
 * Settings → Data export control (#81 story 5/6). Asks the server for the CSV
 * of **every** transaction — not the current Pulse range — then hands it to the
 * browser as a download. The serialization is pure and server-side
 * ({@link exportTransactionsCsvAction}); this component only owns the click,
 * the pending state, and the blob-download plumbing (which needs the DOM, so it
 * can't live in `lib/`).
 */
export function ExportControl() {
  const [pending, setPending] = useState(false);
  const notify = useNotify();

  async function handleExport() {
    setPending(true);
    try {
      const csv = await exportTransactionsCsvAction();
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
    <Button
      type="button"
      variant="outline"
      onClick={handleExport}
      disabled={pending}
    >
      <Download data-icon="inline-start" aria-hidden />
      {pending ? "Exporting…" : "Export transactions (CSV)"}
    </Button>
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
