// ---------------------------------------------------------------------------
// Draft Integrity — computes and verifies a Merkle root over draft rows.
// This catches structural tampering: if any row was added, removed, or
// modified while the draft was at rest, the root won't match.
//
// Uses the same BLAKE3 domain hashing and Merkle tree as the manifest
// compiler, but over the pre-compilation UI row data (not compiled PayrollRows).
// ---------------------------------------------------------------------------

import type { PayrollTableRow } from "@/components/payroll-table/types";
import { domainHash, toHex, DOMAIN_TAGS } from "@/src/lib/pnw-adapter/hash";
import { buildMerkleTree } from "@/src/lib/pnw-adapter/merkle";

const DRAFT_DOMAIN = "PNW::DRAFT_ROW";

/**
 * Hash a single draft row into a leaf for the integrity Merkle tree.
 * Includes all fields that affect payroll — if any field changes, the hash changes.
 */
function hashDraftRow(row: PayrollTableRow, epochId: string): string {
  const canonical = [
    row.worker_addr,
    row.worker_name_hash,
    row.agreement_id,
    epochId,
    row.gross_amount,
    row.tax_withheld,
    row.fee_amount,
    row.net_amount,
  ].join("|");

  return toHex(domainHash(DRAFT_DOMAIN, new TextEncoder().encode(canonical)));
}

/**
 * Compute the Merkle root over all draft rows + context.
 * Deterministic: same rows in the same order produce the same root.
 */
export function computeDraftIntegrity(
  rows: PayrollTableRow[],
  epochId: string,
  employerAddr: string,
): string {
  if (rows.length === 0) {
    // Empty draft — hash just the context
    return toHex(
      domainHash(
        DRAFT_DOMAIN,
        new TextEncoder().encode(`empty|${epochId}|${employerAddr}`),
      ),
    );
  }

  // Hash each row into a leaf
  const leaves = rows.map((row) => hashDraftRow(row, epochId));

  // Build Merkle tree
  const tree = buildMerkleTree(leaves);

  // Bind the root to the employer + epoch so the same rows under a different
  // employer or epoch produce a different integrity root
  const contextBinding = new TextEncoder().encode(
    `${tree.root}|${employerAddr}|${epochId}`,
  );

  return toHex(domainHash(DOMAIN_TAGS.LEAF, contextBinding));
}

/**
 * Verify that rows match a previously computed integrity root.
 */
export function verifyDraftIntegrity(
  rows: PayrollTableRow[],
  epochId: string,
  employerAddr: string,
  expectedRoot: string,
): boolean {
  const computed = computeDraftIntegrity(rows, epochId, employerAddr);
  return computed === expectedRoot;
}
