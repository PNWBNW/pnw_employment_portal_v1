/**
 * Shared helpers for PDF generation.
 * All PDFs use jsPDF directly — no server-side rendering.
 */

import { jsPDF } from "jspdf";
import QRCode from "qrcode";

// ----------------------------------------------------------------
// Constants
// ----------------------------------------------------------------

export const PAGE_MARGIN = 20;
export const LINE_HEIGHT = 7;
export const HEADER_COLOR: [number, number, number] = [30, 58, 138]; // dark blue
export const MUTED_COLOR: [number, number, number] = [120, 120, 120];

// ----------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------

/** Create a new jsPDF document with standard settings */
export function createDoc(): jsPDF {
  return new jsPDF({ orientation: "portrait", unit: "mm", format: "letter" });
}

/** Draw the PNW header with title */
export function drawHeader(doc: jsPDF, title: string, y: number): number {
  doc.setFontSize(18);
  doc.setTextColor(...HEADER_COLOR);
  doc.text("Proven National Workers", PAGE_MARGIN, y);
  y += 8;
  doc.setFontSize(14);
  doc.text(title, PAGE_MARGIN, y);
  y += 4;

  // Separator line
  doc.setDrawColor(...HEADER_COLOR);
  doc.setLineWidth(0.5);
  doc.line(PAGE_MARGIN, y, 195, y);
  y += 8;

  return y;
}

/** Draw a label: value pair */
export function drawField(
  doc: jsPDF,
  label: string,
  value: string,
  y: number,
  opts?: { mono?: boolean },
): number {
  doc.setFontSize(9);
  doc.setTextColor(...MUTED_COLOR);
  doc.text(label, PAGE_MARGIN, y);
  doc.setTextColor(0, 0, 0);
  if (opts?.mono) {
    doc.setFont("courier", "normal");
  }
  doc.text(value, PAGE_MARGIN + 45, y);
  doc.setFont("helvetica", "normal");
  return y + LINE_HEIGHT;
}

/** Format minor units (1_000_000 = $1.00) to display string */
export function formatMinorUnits(value: string): string {
  const num = Number(value);
  if (isNaN(num)) return value;
  const dollars = num / 1_000_000;
  return `$${dollars.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Truncate a hash for display */
export function truncateHash(hash: string, len = 20): string {
  if (hash.length <= len) return hash;
  return `${hash.slice(0, len)}...`;
}

/** Draw a privacy notice footer */
export function drawPrivacyFooter(doc: jsPDF, y: number): number {
  if (y > 250) {
    doc.addPage();
    y = PAGE_MARGIN;
  }
  y += 4;
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.3);
  doc.line(PAGE_MARGIN, y, 195, y);
  y += 6;
  doc.setFontSize(7);
  doc.setTextColor(...MUTED_COLOR);
  doc.text(
    "This document was generated client-side. No private data was transmitted to any server.",
    PAGE_MARGIN,
    y,
  );
  y += 4;
  doc.text(
    "Proven National Workers — Privacy-first payroll. All on-chain values are hashes and commitments only.",
    PAGE_MARGIN,
    y,
  );
  return y;
}

/** Generate a QR code data URL for embedding in PDF */
export async function generateQrDataUrl(text: string): Promise<string> {
  return QRCode.toDataURL(text, { width: 100, margin: 1 });
}

/** Draw a QR code on the PDF (synchronous — pass pre-generated data URL) */
export function drawQrCode(
  doc: jsPDF,
  dataUrl: string,
  x: number,
  y: number,
  size = 25,
): void {
  doc.addImage(dataUrl, "PNG", x, y, size, size);
}
