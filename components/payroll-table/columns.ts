/**
 * TanStack Table column definitions for the payroll table.
 *
 * Simplified layout: the employer sees two primary editable columns
 * (Worker Name and Gross), with tax/fee/net available for adjustment.
 * worker_addr, worker_name_hash, and agreement_id are auto-resolved.
 */

import { createColumnHelper } from "@tanstack/react-table";
import type { PayrollTableRow } from "./types";

const columnHelper = createColumnHelper<PayrollTableRow>();

export const payrollColumns = [
  columnHelper.accessor("worker_name", {
    header: "Worker (.pnw)",
    size: 160,
    meta: { editable: true, placeholder: "alice.pnw", type: "worker" },
  }),
  columnHelper.display({
    id: "rate",
    header: "Rate",
    size: 80,
    meta: { type: "text" },
  }),
  columnHelper.accessor("hours_worked", {
    header: "Hours",
    size: 70,
    meta: { editable: true, placeholder: "0", type: "amount" },
  }),
  columnHelper.accessor("gross_amount", {
    header: "Gross ($)",
    size: 110,
    meta: { editable: true, placeholder: "0.00", type: "amount" },
  }),
  columnHelper.accessor("tax_withheld", {
    header: "Tax ($)",
    size: 100,
    meta: { editable: true, placeholder: "auto", type: "amount" },
  }),
  columnHelper.accessor("fee_amount", {
    header: "Fee ($)",
    size: 100,
    meta: { editable: true, placeholder: "0.00", type: "amount" },
  }),
  columnHelper.accessor("net_amount", {
    header: "Net ($)",
    size: 110,
    meta: { editable: true, placeholder: "0.00", type: "amount", computed: true },
  }),
  columnHelper.display({
    id: "status",
    header: "Status",
    size: 60,
  }),
  columnHelper.display({
    id: "actions",
    header: "",
    size: 40,
  }),
];

// Augment TanStack Table's ColumnMeta type
declare module "@tanstack/react-table" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData extends unknown, TValue> {
    editable?: boolean;
    placeholder?: string;
    monospace?: boolean;
    type?: "amount" | "text" | "worker";
    computed?: boolean;
  }
}
