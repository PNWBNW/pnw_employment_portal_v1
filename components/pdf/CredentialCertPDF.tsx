/**
 * CredentialCertPDF — credential certificate document.
 *
 * Contains: credential type, scope, expiry, tx ID, issuer (truncated),
 * subject (truncated), and QR code linking to explorer tx.
 *
 * Privacy: No raw keys or full names. Only hashes and truncated addresses.
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
import type { CredentialRecord } from "@/src/stores/credential_store";

export function generateCredentialCertPdf(credential: CredentialRecord): jsPDF {
  const doc = createDoc();

  let y = PAGE_MARGIN;
  y = drawHeader(doc, "Credential Certificate", y);

  // Credential type badge
  doc.setFontSize(11);
  doc.setTextColor(...HEADER_COLOR);
  doc.text(credential.credential_type_label, PAGE_MARGIN, y);
  y += 8;

  // Status
  const isRevoked = credential.status === "revoked";
  doc.setFontSize(9);
  doc.setTextColor(isRevoked ? 180 : 22, isRevoked ? 30 : 101, isRevoked ? 30 : 52);
  doc.text(isRevoked ? "STATUS: REVOKED" : "STATUS: ACTIVE", PAGE_MARGIN, y);
  y += 8;

  doc.setTextColor(0, 0, 0);

  // Credential details
  y = drawField(doc, "Credential ID:", truncateHash(credential.credential_id, 28), y, { mono: true });
  y = drawField(doc, "Scope:", credential.scope, y);
  y = drawField(
    doc,
    "Valid Through:",
    credential.expires_epoch ? `Epoch ${credential.expires_epoch}` : "No Expiry",
    y,
  );
  y = drawField(doc, "Issued Epoch:", String(credential.issued_epoch), y);
  y += 4;

  // Parties (hashes only — privacy preserved)
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  doc.text("Parties", PAGE_MARGIN, y);
  y += 6;

  y = drawField(doc, "Subject Hash:", truncateHash(credential.subject_hash, 28), y, { mono: true });
  y = drawField(doc, "Issuer Hash:", truncateHash(credential.issuer_hash, 28), y, { mono: true });
  y = drawField(doc, "Scope Hash:", truncateHash(credential.scope_hash, 28), y, { mono: true });
  y = drawField(doc, "Doc Hash:", truncateHash(credential.doc_hash, 28), y, { mono: true });
  y += 4;

  // On-chain reference
  if (credential.tx_id) {
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.text("On-Chain Reference", PAGE_MARGIN, y);
    y += 6;
    y = drawField(doc, "Transaction ID:", truncateHash(credential.tx_id, 28), y, { mono: true });
    y += 2;

    // Explorer link note
    doc.setFontSize(8);
    doc.setTextColor(...MUTED_COLOR);
    doc.text(
      `Verify at: https://explorer.provable.com/transaction/${credential.tx_id}`,
      PAGE_MARGIN,
      y,
    );
    y += 6;
  }

  // Revocation info
  if (isRevoked && credential.revoke_tx_id) {
    y += 4;
    doc.setFontSize(10);
    doc.setTextColor(180, 30, 30);
    doc.text("Revocation", PAGE_MARGIN, y);
    y += 6;
    doc.setTextColor(0, 0, 0);
    y = drawField(doc, "Revoke TX:", truncateHash(credential.revoke_tx_id, 28), y, { mono: true });
  }

  // Privacy footer
  y += 8;
  drawPrivacyFooter(doc, y);

  return doc;
}
