"use client";

import { useMemo } from "react";
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

type Props = {
  rows: PayrollTableRow[];
  onUpdateRow: (index: number, field: keyof PayrollTableRow, value: string) => void;
  onRemoveRow: (index: number) => void;
  validationResults: RowValidationResult[];
};

export function PayrollTable({
  rows,
  onUpdateRow,
  onRemoveRow,
  validationResults,
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
                          ) : (
                            <span className="text-green-500">✓</span>
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

                    // Editable cells
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
              <TableCell colSpan={3} className="text-right text-xs">
                Totals:
              </TableCell>
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
