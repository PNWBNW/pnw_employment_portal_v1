/**
 * PaystubPDF — generates a paystub PDF for a single worker for a single epoch.
 *
 * Contains: worker address (truncated), epoch, gross/tax/fee/net amounts,
 * tx ID, batch anchor hash, and QR code linking to the explorer.
 *
 * Privacy: No raw private keys, view keys, or full names appear in the PDF.
 * Worker address is truncated. All displayed values are from the manifest
 * (which only contains hashes and commitments on-chain).
 */

import type { PayrollRunManifest, PayrollRow } from "@/src/manifest/types";
import {
  createDoc,
  drawHeader,
  drawField,
  drawPrivacyFooter,
  formatMinorUnits,
  truncateHash,
  PAGE_MARGIN,
  LINE_HEIGHT,
} from "./pdf_helpers";
import type { jsPDF } from "jspdf";

export type PaystubPdfInput = {
  manifest: PayrollRunManifest;
  row: PayrollRow;
  workerDisplayName?: string;
};

/**
 * Generate a paystub PDF for a single worker/epoch.
 * Returns the jsPDF instance (caller decides to save/download).
 */
export function generatePaystubPdf(input: PaystubPdfInput): jsPDF {
  const { manifest, row, workerDisplayName } = input;
  const doc = createDoc();

  let y = PAGE_MARGIN;
  y = drawHeader(doc, "Paystub", y);

  // Worker info
  y = drawField(doc, "Worker:", workerDisplayName ?? truncateHash(row.worker_addr, 24), y);
  y = drawField(doc, "Worker Address:", truncateHash(row.worker_addr, 24), y, { mono: true });
  y = drawField(doc, "Epoch:", String(manifest.epoch_id), y);
  y = drawField(doc, "Currency:", manifest.currency, y);
  y += 4;

  // Amounts table
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  doc.text("Earnings Summary", PAGE_MARGIN, y);
  y += 6;

  const amountRows = [
    ["Gross Pay", formatMinorUnits(row.gross_amount)],
    ["Tax Withheld", `(${formatMinorUnits(row.tax_withheld)})`],
    ["Fees", `(${formatMinorUnits(row.fee_amount)})`],
    ["Net Pay", formatMinorUnits(row.net_amount)],
  ];

  doc.setFontSize(9);
  for (const [label, amount] of amountRows) {
    doc.setTextColor(100, 100, 100);
    doc.text(label, PAGE_MARGIN + 4, y);
    doc.setTextColor(0, 0, 0);
    doc.text(amount, PAGE_MARGIN + 80, y, { align: "right" });
    y += LINE_HEIGHT;
  }

  // Net pay highlight
  y += 2;
  doc.setDrawColor(200, 200, 200);
  doc.line(PAGE_MARGIN + 4, y - LINE_HEIGHT - 1, PAGE_MARGIN + 80, y - LINE_HEIGHT - 1);

  y += 4;

  // On-chain references
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  doc.text("On-Chain References", PAGE_MARGIN, y);
  y += 6;

  if (row.tx_id) {
    y = drawField(doc, "Transaction ID:", truncateHash(row.tx_id, 24), y, { mono: true });
  }
  y = drawField(doc, "Row Hash:", truncateHash(row.row_hash, 24), y, { mono: true });
  y = drawField(doc, "Batch ID:", truncateHash(manifest.batch_id, 24), y, { mono: true });

  if (manifest.anchor_tx_id) {
    y = drawField(doc, "Anchor TX:", truncateHash(manifest.anchor_tx_id, 24), y, { mono: true });
  }
  if (manifest.row_root) {
    y = drawField(doc, "Batch Root:", truncateHash(manifest.row_root, 24), y, { mono: true });
  }

  y += 4;
  y = drawField(doc, "Employer:", truncateHash(manifest.employer_addr, 24), y, { mono: true });

  // Privacy footer
  y += 8;
  drawPrivacyFooter(doc, y);

  return doc;
}
