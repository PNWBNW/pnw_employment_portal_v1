/**
 * TanStack Table column definitions for the payroll table.
 */

import { createColumnHelper } from "@tanstack/react-table";
import type { PayrollTableRow } from "./types";

const columnHelper = createColumnHelper<PayrollTableRow>();

export const payrollColumns = [
  columnHelper.accessor("worker_name", {
    header: "Worker",
    size: 140,
    meta: { editable: true, placeholder: "Name" },
  }),
  columnHelper.accessor("agreement_id", {
    header: "Agreement ID",
    size: 130,
    meta: { editable: true, placeholder: "Agreement ID", monospace: true },
  }),
  columnHelper.accessor("epoch_id", {
    header: "Epoch",
    size: 100,
    meta: { editable: true, placeholder: "YYYYMMDD" },
  }),
  columnHelper.accessor("gross_amount", {
    header: "Gross ($)",
    size: 110,
    meta: { editable: true, placeholder: "0.00", type: "amount" },
  }),
  columnHelper.accessor("tax_withheld", {
    header: "Tax ($)",
    size: 100,
    meta: { editable: true, placeholder: "0.00", type: "amount" },
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
    type?: "amount" | "text";
    computed?: boolean;
  }
}
