/**
 * PayrollRunPDF — full employer payroll run summary document.
 *
 * Contains: batch_id, row_root, epoch, worker count, totals,
 * per-row amounts + tx IDs, anchor TX + NFT ID, QR code to explorer.
 *
 * Privacy: No raw keys or full names. Only truncated addresses and hashes.
 */

import type { PayrollRunManifest } from "@/src/manifest/types";
import {
  createDoc,
  drawHeader,
  drawField,
  drawPrivacyFooter,
  formatMinorUnits,
  truncateHash,
  PAGE_MARGIN,
  LINE_HEIGHT,
  MUTED_COLOR,
} from "./pdf_helpers";
import type { jsPDF } from "jspdf";

export type PayrollRunPdfInput = {
  manifest: PayrollRunManifest;
  /** Optional display names keyed by worker_addr */
  workerNames?: Record<string, string>;
};

export function generatePayrollRunPdf(input: PayrollRunPdfInput): jsPDF {
  const { manifest, workerNames } = input;
  const doc = createDoc();

  let y = PAGE_MARGIN;
  y = drawHeader(doc, "Payroll Run Summary", y);

  // Run metadata
  y = drawField(doc, "Batch ID:", truncateHash(manifest.batch_id, 28), y, { mono: true });
  y = drawField(doc, "Epoch:", String(manifest.epoch_id), y);
  y = drawField(doc, "Workers:", String(manifest.row_count), y);
  y = drawField(doc, "Status:", manifest.status.toUpperCase(), y);
  y = drawField(doc, "Currency:", manifest.currency, y);
  y += 2;

  // Totals
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  doc.text("Totals", PAGE_MARGIN, y);
  y += 6;

  y = drawField(doc, "Total Gross:", formatMinorUnits(manifest.total_gross_amount), y);
  y = drawField(doc, "Total Tax:", formatMinorUnits(manifest.total_tax_withheld), y);
  y = drawField(doc, "Total Fees:", formatMinorUnits(manifest.total_fee_amount), y);
  y = drawField(doc, "Total Net:", formatMinorUnits(manifest.total_net_amount), y);
  y += 4;

  // Anchor info
  if (manifest.anchor_tx_id) {
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.text("Batch Anchor", PAGE_MARGIN, y);
    y += 6;
    y = drawField(doc, "Anchor TX:", truncateHash(manifest.anchor_tx_id, 28), y, { mono: true });
    if (manifest.anchor_nft_id) {
      y = drawField(doc, "NFT ID:", truncateHash(manifest.anchor_nft_id, 28), y, { mono: true });
    }
    y = drawField(doc, "Row Root:", truncateHash(manifest.row_root, 28), y, { mono: true });
    y += 4;
  }

  // Per-worker detail blocks (one per worker — more space for full info)
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  doc.text("Worker Detail", PAGE_MARGIN, y);
  y += 6;

  for (const row of manifest.rows) {
    if (y > 250) {
      doc.addPage();
      y = PAGE_MARGIN;
    }

    // Worker header: row number + .pnw name
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);
    const pnwName = workerNames?.[row.worker_addr];
    const headerLine = pnwName
      ? `#${row.row_index}  ${pnwName}`
      : `#${row.row_index}  (no .pnw name)`;
    doc.text(headerLine, PAGE_MARGIN, y);

    // Status badge on the right
    doc.setFontSize(7);
    doc.setTextColor(...MUTED_COLOR);
    doc.text(row.status.toUpperCase(), 185, y, { align: "right" });
    y += 4;

    // Full Aleo address (monospace, small)
    doc.setFont("courier", "normal");
    doc.setFontSize(6);
    doc.setTextColor(...MUTED_COLOR);
    doc.text(row.worker_addr, PAGE_MARGIN, y);
    y += 3;

    // Amounts row
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(0, 0, 0);
    const amountsLine =
      `Gross: ${formatMinorUnits(row.gross_amount)}   ` +
      `Tax: ${formatMinorUnits(row.tax_withheld)}   ` +
      `Fees: ${formatMinorUnits(row.fee_amount)}   ` +
      `Net: ${formatMinorUnits(row.net_amount)}`;
    doc.text(amountsLine, PAGE_MARGIN, y);
    y += 4;

    // TX ID line (full — wraps if needed)
    if (row.tx_id) {
      doc.setFont("courier", "normal");
      doc.setFontSize(6);
      doc.setTextColor(...MUTED_COLOR);
      doc.text(`TX: ${row.tx_id}`, PAGE_MARGIN, y);
      doc.setFont("helvetica", "normal");
      y += 3;
    }

    // Separator line
    doc.setDrawColor(230, 230, 230);
    doc.line(PAGE_MARGIN, y, 195, y);
    y += 4;
  }

  // Privacy footer
  y += 8;
  drawPrivacyFooter(doc, y);

  return doc;
}
