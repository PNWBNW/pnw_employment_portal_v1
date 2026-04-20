"use client";

import { useRef, useCallback } from "react";
import type { PayrollTableRow } from "./types";
import { createEmptyRow, parseDollar, formatDollar } from "./types";
import type { FilingStatus } from "@/src/lib/tax-engine";

const FILING_STATUS_OPTIONS: { value: FilingStatus; label: string }[] = [
  { value: "single", label: "Single" },
  { value: "married_filing_jointly", label: "Married Filing Jointly" },
  { value: "married_filing_separately", label: "Married Filing Separately" },
  { value: "head_of_household", label: "Head of Household" },
];

type Props = {
  rows: PayrollTableRow[];
  onAddRow: (row: PayrollTableRow) => void;
  onImportRows: (rows: PayrollTableRow[]) => void;
  onSaveDraft: () => void;
  onClearAll: () => void;
  allValid: boolean;
  epochId: string;
  onEpochChange: (epoch: string) => void;
  filingStatus: FilingStatus;
  onFilingStatusChange: (status: FilingStatus) => void;
};

export function PayrollTableToolbar({
  rows,
  onAddRow,
  onImportRows,
  onSaveDraft,
  onClearAll,
  allValid,
  epochId,
  onEpochChange,
  filingStatus,
  onFilingStatusChange,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAddRow = useCallback(() => {
    const row = createEmptyRow();
    row.epoch_id = epochId;
    onAddRow(row);
  }, [epochId, onAddRow]);

  const handleCSVImport = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result;
        if (typeof text !== "string") return;

        const lines = text.trim().split("\n");
        if (lines.length < 2) return; // Need header + at least 1 data row

        // Parse header to find column indices
        const header = lines[0]!.split(",").map((h) => h.trim().toLowerCase());
        const colMap = {
          worker: findCol(header, ["worker", "name", "worker_name"]),
          gross: findCol(header, ["gross", "gross_amount", "gross_pay"]),
          tax: findCol(header, ["tax", "tax_withheld", "tax_amount"]),
          fee: findCol(header, ["fee", "fee_amount"]),
        };

        const imported: PayrollTableRow[] = [];
        for (let i = 1; i < lines.length; i++) {
          const line = lines[i]!.trim();
          if (!line) continue;

          const cols = parseCSVLine(line);
          const row = createEmptyRow();
          row.epoch_id = epochId;

          if (colMap.worker !== -1) row.worker_name = cols[colMap.worker] ?? "";

          if (colMap.gross !== -1) row.gross_amount = cols[colMap.gross] ?? "";
          if (colMap.tax !== -1) row.tax_withheld = cols[colMap.tax] ?? "";
          if (colMap.fee !== -1) row.fee_amount = cols[colMap.fee] ?? "";

          // Auto-calculate net
          const gross = parseDollar(row.gross_amount);
          const tax = parseDollar(row.tax_withheld);
          const fee = parseDollar(row.fee_amount);
          if (!isNaN(gross) && !isNaN(tax) && !isNaN(fee)) {
            row.net_amount = formatDollar(gross - tax - fee);
          }

          imported.push(row);
        }

        if (imported.length > 0) {
          onImportRows(imported);
        }
      };
      reader.readAsText(file);

      // Reset file input so the same file can be re-imported
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    },
    [epochId, onImportRows],
  );

  // Format the epoch_id as a human-readable timestamp for display.
  // epoch_id is a unix-seconds value that uniquely identifies this run.
  const epochDisplay = (() => {
    const seconds = parseInt(epochId, 10);
    if (!seconds || isNaN(seconds)) return "";
    // Legacy YYYYMMDD format (8 digits)
    if (seconds >= 19700101 && seconds <= 99999999) {
      const y = Math.floor(seconds / 10000);
      const m = Math.floor((seconds % 10000) / 100);
      const d = seconds % 100;
      return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")} (legacy)`;
    }
    return new Date(seconds * 1000).toLocaleString();
  })();

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex flex-col gap-0.5">
        <div className="flex items-center gap-2">
          <label className="text-sm text-muted-foreground">Epoch:</label>
          <input
            type="text"
            value={epochId}
            onChange={(e) => onEpochChange(e.target.value)}
            placeholder="unix seconds"
            className="w-36 rounded-md border border-input bg-background px-2 py-1 text-sm font-mono"
          />
          <button
            type="button"
            onClick={() => onEpochChange(Math.floor(Date.now() / 1000).toString())}
            className="rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:bg-muted"
            title="Reset to current timestamp (for re-running tests)"
          >
            ↻
          </button>
        </div>
        {epochDisplay && (
          <p className="text-[10px] text-muted-foreground pl-12">{epochDisplay}</p>
        )}
      </div>

      <div className="flex items-center gap-2">
        <label className="text-sm text-muted-foreground">Currency:</label>
        <span className="rounded-md border border-input bg-muted px-2 py-1 text-sm text-muted-foreground">
          USDCx
        </span>
      </div>

      <div className="flex items-center gap-2">
        <label className="text-sm text-muted-foreground">Filing:</label>
        <select
          value={filingStatus}
          onChange={(e) => onFilingStatusChange(e.target.value as FilingStatus)}
          className="rounded-md border border-input bg-background px-2 py-1 text-sm"
        >
          {FILING_STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <button
          onClick={handleAddRow}
          className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:bg-primary/90"
        >
          + Add Row
        </button>

        <label className="cursor-pointer rounded-md border border-input px-3 py-1.5 text-sm hover:bg-accent">
          Import CSV
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            onChange={handleCSVImport}
            className="hidden"
          />
        </label>

        <button
          onClick={onSaveDraft}
          className="rounded-md border border-input px-3 py-1.5 text-sm hover:bg-accent"
        >
          Save Draft
        </button>

        {rows.length > 0 && (
          <button
            onClick={onClearAll}
            className="rounded-md border border-input px-3 py-1.5 text-sm text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          >
            Clear All
          </button>
        )}
      </div>

      {rows.length > 0 && (
        <div className="w-full text-xs text-muted-foreground">
          {rows.length} row{rows.length !== 1 ? "s" : ""} ·{" "}
          {allValid ? (
            <span className="text-green-600 dark:text-green-400">
              All rows valid
            </span>
          ) : (
            <span className="text-red-500">
              Some rows have validation errors
            </span>
          )}
        </div>
      )}
    </div>
  );
}

/** Find a column index by trying multiple possible header names */
function findCol(headers: string[], candidates: string[]): number {
  for (const candidate of candidates) {
    const idx = headers.indexOf(candidate);
    if (idx !== -1) return idx;
  }
  return -1;
}

/** Parse a CSV line respecting quoted fields */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i]!;
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}
