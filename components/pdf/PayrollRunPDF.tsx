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

  // Per-row table
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  doc.text("Worker Detail", PAGE_MARGIN, y);
  y += 6;

  // Table header
  doc.setFontSize(7);
  doc.setTextColor(...MUTED_COLOR);
  const colX = [PAGE_MARGIN, PAGE_MARGIN + 30, PAGE_MARGIN + 65, PAGE_MARGIN + 90, PAGE_MARGIN + 115, PAGE_MARGIN + 140];
  doc.text("#", colX[0]!, y);
  doc.text("Worker", colX[1]!, y);
  doc.text("Gross", colX[2]!, y);
  doc.text("Net", colX[3]!, y);
  doc.text("Status", colX[4]!, y);
  doc.text("TX ID", colX[5]!, y);
  y += 1;
  doc.setDrawColor(200, 200, 200);
  doc.line(PAGE_MARGIN, y, 195, y);
  y += 4;

  doc.setFontSize(7);
  for (const row of manifest.rows) {
    if (y > 260) {
      doc.addPage();
      y = PAGE_MARGIN;
    }

    doc.setTextColor(0, 0, 0);
    doc.text(String(row.row_index), colX[0]!, y);

    const displayName = workerNames?.[row.worker_addr] ?? truncateHash(row.worker_addr, 12);
    doc.text(displayName, colX[1]!, y);
    doc.text(formatMinorUnits(row.gross_amount), colX[2]!, y);
    doc.text(formatMinorUnits(row.net_amount), colX[3]!, y);
    doc.text(row.status, colX[4]!, y);

    if (row.tx_id) {
      doc.setFont("courier", "normal");
      doc.text(truncateHash(row.tx_id, 12), colX[5]!, y);
      doc.setFont("helvetica", "normal");
    }
    y += LINE_HEIGHT - 2;
  }

  // Privacy footer
  y += 8;
  drawPrivacyFooter(doc, y);

  return doc;
}
