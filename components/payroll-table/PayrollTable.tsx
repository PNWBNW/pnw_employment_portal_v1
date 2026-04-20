"use client";

import { useMemo, useState, useRef, useEffect, useCallback } from "react";
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
} from "@tanstack/react-table";
import {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { payrollColumns } from "./columns";
import type { PayrollTableRow } from "./types";
import { parseDollar, formatDollar } from "./types";
import type { RowValidationResult } from "./types";
import { validateRow } from "./validation";
import type { WorkerRecord } from "@/src/stores/worker_store";
import { getWorkerSuggestions } from "./worker_resolver";

type Props = {
  rows: PayrollTableRow[];
  onUpdateRow: (index: number, field: keyof PayrollTableRow, value: string) => void;
  onRemoveRow: (index: number) => void;
  onSelectWorker: (index: number, worker: WorkerRecord) => void;
  validationResults: RowValidationResult[];
  workers: WorkerRecord[];
};

export function PayrollTable({
  rows,
  onUpdateRow,
  onRemoveRow,
  onSelectWorker,
  validationResults,
  workers,
}: Props) {
  const table = useReactTable({
    data: rows,
    columns: payrollColumns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => row.id,
  });

  // Compute totals
  const totals = useMemo(() => {
    let gross = 0;
    let tax = 0;
    let fee = 0;
    let net = 0;
    for (const row of rows) {
      const g = parseDollar(row.gross_amount);
      const t = parseDollar(row.tax_withheld);
      const f = parseDollar(row.fee_amount);
      const n = parseDollar(row.net_amount);
      if (!isNaN(g)) gross += g;
      if (!isNaN(t)) tax += t;
      if (!isNaN(f)) fee += f;
      if (!isNaN(n)) net += n;
    }
    return { gross, tax, fee, net };
  }, [rows]);

  return (
    <div className="rounded-lg border border-border">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id} className="bg-muted/50">
              {headerGroup.headers.map((header) => (
                <TableHead
                  key={header.id}
                  style={{ width: header.getSize() }}
                  className="text-xs font-medium"
                >
                  {header.isPlaceholder
                    ? null
                    : flexRender(
                        header.column.columnDef.header,
                        header.getContext(),
                      )}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={payrollColumns.length}
                className="h-24 text-center text-muted-foreground"
              >
                No rows yet. Click &quot;Add Row&quot; to start building your
                payroll.
              </TableCell>
            </TableRow>
          ) : (
            table.getRowModel().rows.map((row) => {
              const rowIndex = row.index;
              const validation = validationResults[rowIndex] ?? validateRow(rows[rowIndex]!);
              const hasErrors = !validation.valid;
              const rowData = rows[rowIndex]!;

              return (
                <TableRow
                  key={row.id}
                  className={hasErrors ? "bg-red-50/50 dark:bg-red-950/10" : ""}
                >
                  {row.getVisibleCells().map((cell) => {
                    const meta = cell.column.columnDef.meta;
                    const columnId = cell.column.id;

                    // Status column
                    if (columnId === "status") {
                      return (
                        <TableCell key={cell.id} className="text-center">
                          {hasErrors ? (
                            <span
                              className="cursor-help text-red-500"
                              title={validation.errors
                                .map((e) => `${e.field}: ${e.message}`)
                                .join("\n")}
                            >
                              ✗
                            </span>
                          ) : rowData.resolved ? (
                            <span className="text-green-500" title="Worker resolved, row valid">✓</span>
                          ) : (
                            <span className="text-amber-500" title="Select a worker">?</span>
                          )}
                        </TableCell>
                      );
                    }

                    // Actions column
                    if (columnId === "actions") {
                      return (
                        <TableCell key={cell.id} className="text-center">
                          <button
                            onClick={() => onRemoveRow(rowIndex)}
                            className="text-muted-foreground hover:text-destructive"
                            title="Remove row"
                          >
                            ×
                          </button>
                        </TableCell>
                      );
                    }

                    // Worker name cell — with autocomplete dropdown
                    if (columnId === "worker_name" && meta?.type === "worker") {
                      const fieldErrors = validation.errors.filter(
                        (e) => e.field === "worker_name",
                      );
                      return (
                        <TableCell key={cell.id} className="p-1">
                          <WorkerNameCell
                            value={rowData.worker_name}
                            resolved={rowData.resolved}
                            workers={workers}
                            rows={rows}
                            currentRowId={rowData.id}
                            hasError={fieldErrors.length > 0}
                            errorMessage={fieldErrors.map((e) => e.message).join("; ")}
                            onChange={(val) => onUpdateRow(rowIndex, "worker_name", val)}
                            onSelect={(worker) => onSelectWorker(rowIndex, worker)}
                          />
                        </TableCell>
                      );
                    }

                    // Rate display column (read-only, from agreement)
                    if (columnId === "rate") {
                      const rate = rowData.pay_rate;
                      const type = rowData.pay_type;
                      return (
                        <TableCell key={cell.id} className="px-2 py-1 text-right text-xs text-muted-foreground">
                          {rate && rate > 0
                            ? type === "hourly"
                              ? `$${rate.toFixed(2)}/hr`
                              : `$${rate.toFixed(2)}`
                            : "—"}
                        </TableCell>
                      );
                    }

                    // Hours column — editable for hourly, shows "—" for salary
                    if (columnId === "hours_worked") {
                      if (rowData.pay_type === "salary") {
                        return (
                          <TableCell key={cell.id} className="px-2 py-1 text-center text-xs text-muted-foreground">
                            —
                          </TableCell>
                        );
                      }
                      const cellValue = cell.getValue() as string;
                      return (
                        <TableCell key={cell.id} className="p-1">
                          <input
                            type="text"
                            value={cellValue}
                            onChange={(e) =>
                              onUpdateRow(rowIndex, "hours_worked", e.target.value)
                            }
                            placeholder="0"
                            className="w-full rounded border border-input bg-background px-2 py-1 text-right text-sm"
                          />
                        </TableCell>
                      );
                    }

                    // Editable amount cells
                    if (meta?.editable) {
                      const fieldName = columnId as keyof PayrollTableRow;
                      const fieldErrors = validation.errors.filter(
                        (e) => e.field === fieldName,
                      );
                      const cellValue = cell.getValue() as string;

                      return (
                        <TableCell key={cell.id} className="p-1">
                          <input
                            type="text"
                            value={cellValue}
                            onChange={(e) =>
                              onUpdateRow(rowIndex, fieldName, e.target.value)
                            }
                            placeholder={meta.placeholder}
                            className={`w-full rounded border px-2 py-1 text-sm ${
                              meta.monospace ? "font-mono text-xs" : ""
                            } ${
                              meta.type === "amount" ? "text-right" : ""
                            } ${
                              fieldErrors.length > 0
                                ? "border-red-400 bg-red-50 dark:border-red-800 dark:bg-red-950/20"
                                : "border-input bg-background"
                            } ${
                              meta.computed
                                ? "bg-muted/50 text-muted-foreground"
                                : ""
                            }`}
                            readOnly={meta.computed}
                            title={
                              fieldErrors.length > 0
                                ? fieldErrors.map((e) => e.message).join("; ")
                                : undefined
                            }
                          />
                        </TableCell>
                      );
                    }

                    // Default render
                    return (
                      <TableCell key={cell.id}>
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )}
                      </TableCell>
                    );
                  })}
                </TableRow>
              );
            })
          )}
        </TableBody>
        {rows.length > 0 && (
          <TableFooter>
            <TableRow className="font-medium">
              <TableCell className="text-right text-xs">
                Totals:
              </TableCell>
              {/* Rate column — empty in footer */}
              <TableCell />
              {/* Hours column — empty in footer */}
              <TableCell />
              <TableCell className="p-2 text-right text-xs">
                ${formatDollar(totals.gross)}
              </TableCell>
              <TableCell className="p-2 text-right text-xs">
                ${formatDollar(totals.tax)}
              </TableCell>
              <TableCell className="p-2 text-right text-xs">
                ${formatDollar(totals.fee)}
              </TableCell>
              <TableCell className="p-2 text-right text-xs font-bold">
                ${formatDollar(totals.net)}
              </TableCell>
              <TableCell colSpan={2} />
            </TableRow>
          </TableFooter>
        )}
      </Table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Worker name cell — autocomplete dropdown
// ---------------------------------------------------------------------------

type WorkerNameCellProps = {
  value: string;
  resolved: boolean;
  workers: WorkerRecord[];
  rows: PayrollTableRow[];
  currentRowId: string;
  hasError: boolean;
  errorMessage: string;
  onChange: (value: string) => void;
  onSelect: (worker: WorkerRecord) => void;
};

function WorkerNameCell({
  value,
  resolved,
  workers,
  rows,
  currentRowId,
  hasError,
  errorMessage,
  onChange,
  onSelect,
}: WorkerNameCellProps) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const suggestions = useMemo(
    () => getWorkerSuggestions(value, workers, rows, currentRowId),
    [value, workers, rows, currentRowId],
  );

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleFocus = useCallback(() => {
    setInputFocused(true);
    setShowDropdown(true);
  }, []);

  const handleBlur = useCallback(() => {
    setInputFocused(false);
    // Delay to allow click on dropdown item
    setTimeout(() => setShowDropdown(false), 200);
  }, []);

  const handleSelect = useCallback(
    (worker: WorkerRecord) => {
      onSelect(worker);
      setShowDropdown(false);
    },
    [onSelect],
  );

  return (
    <div ref={containerRef} className="relative">
      <div className="flex items-center gap-1">
        <input
          type="text"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setShowDropdown(true);
          }}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder="alice.pnw"
          className={`w-full rounded border px-2 py-1 text-sm ${
            hasError
              ? "border-red-400 bg-red-50 dark:border-red-800 dark:bg-red-950/20"
              : resolved
                ? "border-green-400 bg-green-50/50 dark:border-green-800 dark:bg-green-950/20"
                : "border-input bg-background"
          }`}
          title={hasError ? errorMessage : resolved ? "Worker resolved" : "Type a .pnw name"}
        />
        {resolved && (
          <span className="shrink-0 text-xs text-green-600 dark:text-green-400" title="Resolved">
            ●
          </span>
        )}
      </div>

      {/* Autocomplete dropdown */}
      {showDropdown && suggestions.length > 0 && inputFocused && (
        <div className="absolute left-0 top-full z-50 mt-1 max-h-40 w-64 overflow-y-auto rounded-md border border-border bg-popover shadow-md">
          {suggestions.map((worker) => (
            <button
              key={worker.agreement_id}
              type="button"
              className="flex w-full items-center justify-between px-3 py-1.5 text-left text-sm hover:bg-accent"
              onMouseDown={(e) => {
                e.preventDefault();
                handleSelect(worker);
              }}
            >
              <span className="font-medium">
                {worker.display_name || "Unnamed"}
              </span>
              <span className="ml-2 font-mono text-xs text-muted-foreground">
                {worker.agreement_id.slice(0, 8)}...
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
