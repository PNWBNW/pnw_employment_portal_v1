// ============================================================
// SYNCED FILE — do not edit here
// Source: pnw_mvp_v2/portal/src/commitments/canonical_encoder.ts
// Synced from commit: pending-initial-sync
// Synced on: 2026-03-15
// If you need to change this, edit pnw_mvp_v2 first, then re-sync.
// ============================================================

// TLV (Tag-Length-Value) encoding for canonical hashing

export function tlvEncode(tag: number, fields: Array<{ tag: number; value: Uint8Array }>): Uint8Array {
  // Stub: concatenates tag bytes + field TLVs
  const parts: Uint8Array[] = [];
  const tagBytes = new Uint8Array(2);
  tagBytes[0] = (tag >> 8) & 0xff;
  tagBytes[1] = tag & 0xff;
  parts.push(tagBytes);

  for (const field of fields) {
    const fieldTag = new Uint8Array(2);
    fieldTag[0] = (field.tag >> 8) & 0xff;
    fieldTag[1] = field.tag & 0xff;

    const len = new Uint8Array(2);
    len[0] = (field.value.length >> 8) & 0xff;
    len[1] = field.value.length & 0xff;

    parts.push(fieldTag, len, field.value);
  }

  const totalLen = parts.reduce((sum, p) => sum + p.length, 0);
  const result = new Uint8Array(totalLen);
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

// TLV object tags
export const OBJ_PAYROLL_MANIFEST = 0x3001;
export const OBJ_PAYROLL_ROW = 0x3002;
export const OBJ_INPUTS_SET = 0x2001;
export const OBJ_PAYSTUB_DOC = 0x2002;
export const OBJ_RECEIPT_PAIR = 0x2003;
export const OBJ_UTC_TIME = 0x2004;
export const OBJ_AUDIT_EVENT = 0x2005;
