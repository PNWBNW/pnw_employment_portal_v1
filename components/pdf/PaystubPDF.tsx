/**
 * PaystubPDF — generates a paystub PDF for a single worker for a single epoch.
 *
 * Contains: full worker .pnw name, full worker Aleo address, epoch,
 * gross/tax/fee/net amounts, on-chain references, and optional small
 * credential card thumbnails at the bottom (rendered from Canvas data URLs
 * so the worker can see which credentials they hold alongside their pay).
 *
 * Everything fits on a single page.
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
  /** Optional: pre-rendered credential card PNG data URLs (from canvas.toDataURL).
   *  Each is drawn as a small thumbnail at the bottom of the paystub. */
  credentialCardDataUrls?: string[];
};

/**
 * Generate a paystub PDF for a single worker/epoch.
 * Returns the jsPDF instance (caller decides to save/download).
 */
export function generatePaystubPdf(input: PaystubPdfInput): jsPDF {
  const { manifest, row, workerDisplayName, credentialCardDataUrls } = input;
  const doc = createDoc();

  let y = PAGE_MARGIN;
  y = drawHeader(doc, "Paystub", y);

  // Worker info — full .pnw name and full Aleo address (not truncated)
  y = drawField(
    doc,
    "Worker:",
    workerDisplayName ?? row.worker_addr,
    y,
  );

  // Full address on its own line — use smaller font so it fits
  doc.setFontSize(7);
  doc.setTextColor(100, 100, 100);
  doc.text("Worker Address:", PAGE_MARGIN, y);
  doc.setFont("courier", "normal");
  doc.setTextColor(0, 0, 0);
  doc.text(row.worker_addr, PAGE_MARGIN + 28, y);
  doc.setFont("helvetica", "normal");
  y += LINE_HEIGHT;

  y = drawField(doc, "Epoch:", String(manifest.epoch_id), y);
  y = drawField(doc, "Currency:", manifest.currency, y);
  y += 4;

  // Amounts table
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  doc.text("Earnings Summary", PAGE_MARGIN, y);
  y += 6;

  const amountRows: [string, string][] = [
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

  // Credential thumbnails — small cards at the bottom of the page
  if (credentialCardDataUrls && credentialCardDataUrls.length > 0) {
    y += 8;
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.text("Active Credentials", PAGE_MARGIN, y);
    y += 4;

    // Each thumbnail: 22mm wide × 19mm tall (400:340 aspect ratio — top
    // half only, contour map region, no info band). Fits up to 6 across
    // the page width (175mm usable).
    const thumbW = 22;
    const thumbH = 19;
    const gap = 3;
    const maxPerRow = Math.floor((195 - PAGE_MARGIN * 2 + gap) / (thumbW + gap));

    let cx = PAGE_MARGIN;
    for (let i = 0; i < credentialCardDataUrls.length; i++) {
      // Prevent overflow onto a second page
      if (y + thumbH > 265) break;

      try {
        doc.addImage(
          credentialCardDataUrls[i]!,
          "PNG",
          cx,
          y,
          thumbW,
          thumbH,
        );
      } catch {
        // If the image data is invalid, draw a placeholder rect
        doc.setDrawColor(180, 180, 180);
        doc.rect(cx, y, thumbW, thumbH);
        doc.setFontSize(6);
        doc.setTextColor(150, 150, 150);
        doc.text("?", cx + thumbW / 2, y + thumbH / 2, { align: "center" });
      }

      cx += thumbW + gap;
      if ((i + 1) % maxPerRow === 0) {
        cx = PAGE_MARGIN;
        y += thumbH + gap;
      }
    }

    // Move y past the last row of thumbnails
    y += thumbH + 4;
  }

  // Privacy footer
  y += 4;
  drawPrivacyFooter(doc, y);

  return doc;
}
