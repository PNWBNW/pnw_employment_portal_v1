/**
 * AuditAuthPDF — audit authorization certificate document.
 *
 * Contains: scope, epoch range, expiry, auditor name (display only),
 * auth_id, tx ID, and QR code linking to explorer tx.
 *
 * Privacy: No payroll data. No raw keys or full names.
 * Only hashes, truncated addresses, and the authorization scope.
 */

import {
  createDoc,
  drawHeader,
  drawField,
  drawPrivacyFooter,
  truncateHash,
  PAGE_MARGIN,
  HEADER_COLOR,
  MUTED_COLOR,
} from "./pdf_helpers";
import type { jsPDF } from "jspdf";
import type { AuditRequest } from "@/src/stores/audit_store";

export function generateAuditAuthPdf(request: AuditRequest): jsPDF {
  const doc = createDoc();

  let y = PAGE_MARGIN;
  y = drawHeader(doc, "Audit Authorization Certificate", y);

  // Status badge
  const statusLabel =
    request.status === "minted"
      ? "AUTHORIZED"
      : request.status === "approved"
        ? "APPROVED — PENDING MINT"
        : request.status === "declined"
          ? "DECLINED"
          : "PENDING WORKER CONSENT";

  const isMinted = request.status === "minted";
  doc.setFontSize(10);
  doc.setTextColor(
    isMinted ? 22 : 120,
    isMinted ? 101 : 120,
    isMinted ? 52 : 120,
  );
  doc.text(`STATUS: ${statusLabel}`, PAGE_MARGIN, y);
  y += 8;

  doc.setTextColor(0, 0, 0);

  // Authorization details
  y = drawField(doc, "Auth ID:", truncateHash(request.auth_id, 28), y, {
    mono: true,
  });
  y = drawField(doc, "Scope:", request.scope, y);
  y = drawField(doc, "Epoch Range:", `${request.epoch_from} — ${request.epoch_to}`, y);
  y = drawField(
    doc,
    "Expires:",
    request.expires_epoch ? `Epoch ${request.expires_epoch}` : "No Expiry",
    y,
  );
  y += 4;

  // Parties (privacy-preserving — only truncated addresses)
  doc.setFontSize(10);
  doc.setTextColor(...HEADER_COLOR);
  doc.text("Parties", PAGE_MARGIN, y);
  y += 6;
  doc.setTextColor(0, 0, 0);

  y = drawField(doc, "Employer:", truncateHash(request.employer_addr, 28), y, {
    mono: true,
  });
  y = drawField(doc, "Worker:", truncateHash(request.worker_addr, 28), y, {
    mono: true,
  });
  y = drawField(doc, "Auditor:", truncateHash(request.auditor_addr, 28), y, {
    mono: true,
  });
  if (request.auditor_display_name) {
    y = drawField(doc, "Auditor Name:", request.auditor_display_name, y);
  }
  y += 4;

  // Cryptographic references
  doc.setFontSize(10);
  doc.setTextColor(...HEADER_COLOR);
  doc.text("Cryptographic References", PAGE_MARGIN, y);
  y += 6;
  doc.setTextColor(0, 0, 0);

  y = drawField(doc, "Scope Hash:", truncateHash(request.scope_hash, 28), y, {
    mono: true,
  });
  y = drawField(
    doc,
    "Auth Event Hash:",
    truncateHash(request.authorization_event_hash, 28),
    y,
    { mono: true },
  );
  y = drawField(
    doc,
    "Policy Hash:",
    truncateHash(request.policy_hash, 28),
    y,
    { mono: true },
  );
  y += 4;

  // On-chain reference (if minted)
  if (request.tx_id) {
    doc.setFontSize(10);
    doc.setTextColor(...HEADER_COLOR);
    doc.text("On-Chain Reference", PAGE_MARGIN, y);
    y += 6;
    doc.setTextColor(0, 0, 0);

    y = drawField(doc, "Transaction ID:", truncateHash(request.tx_id, 28), y, {
      mono: true,
    });

    if (request.nft_id) {
      y = drawField(doc, "NFT ID:", truncateHash(request.nft_id, 28), y, {
        mono: true,
      });
    }

    y += 2;
    doc.setFontSize(8);
    doc.setTextColor(...MUTED_COLOR);
    doc.text(
      `Verify at: https://explorer.provable.com/transaction/${request.tx_id}`,
      PAGE_MARGIN,
      y,
    );
    y += 6;
  }

  // Disclosure notice
  y += 4;
  doc.setFontSize(9);
  doc.setTextColor(...HEADER_COLOR);
  doc.text("Disclosure Notice", PAGE_MARGIN, y);
  y += 6;
  doc.setFontSize(8);
  doc.setTextColor(0, 0, 0);
  doc.text(
    "This authorization permits the auditor to view payroll records within the specified",
    PAGE_MARGIN,
    y,
  );
  y += 4;
  doc.text(
    "epoch range only. The employer must share a scoped view key separately.",
    PAGE_MARGIN,
    y,
  );
  y += 4;
  doc.text(
    "No payroll amounts, worker identities, or wage data are contained in this document.",
    PAGE_MARGIN,
    y,
  );
  y += 8;

  // Privacy footer
  drawPrivacyFooter(doc, y);

  return doc;
}
