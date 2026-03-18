/**
 * Sealance Compliance Types
 *
 * Types for the freeze-list exclusion proof system used by compliant
 * stablecoins (USDCx). The Sealance Merkle Tree SDK generates non-membership
 * proofs that prove an address is NOT on the freeze list.
 *
 * Two transfer paths:
 * - transfer_private(addr, amount, token, [MerkleProof; 2u32])
 *     → raw exclusion proof each time
 * - transfer_private_with_creds(addr, amount, token, Credentials)
 *     → reusable credentials record (one proof, many transfers)
 *
 * For batched payroll, the credentials path saves N-1 Merkle proof
 * verifications per run.
 */

import type { Address, Field } from "./aleo_types";

// ----------------------------------------------------------------
// Merkle exclusion proof
// ----------------------------------------------------------------

/** A single Merkle sibling path for the freeze-list tree */
export type MerkleSiblingPath = {
  /** Sibling hashes from leaf to root */
  path: Field[];
  /** Leaf index in the tree */
  leaf_index: number;
  /** Whether each sibling is on the left (true) or right (false) */
  directions: boolean[];
};

/**
 * Formatted Merkle exclusion proof: [MerkleProof; 2u32]
 *
 * Two adjacent-leaf proofs that together prove non-membership:
 * - proof_low: the leaf just below the target address
 * - proof_high: the leaf just above the target address
 * If both exist and are adjacent, the target is NOT in the tree.
 */
export type FreezeListProof = {
  proof_low: MerkleSiblingPath;
  proof_high: MerkleSiblingPath;
};

// ----------------------------------------------------------------
// Credentials record
// ----------------------------------------------------------------

/**
 * On-chain Credentials record produced by get_credentials().
 * Contains the freeze_list_root at the time of proof verification.
 * Reusable for multiple transfer_private_with_creds calls as long
 * as the root hasn't rotated past the block_height_window.
 */
export type CredentialsRecord = {
  owner: Address;
  freeze_list_root: Field;
  /** Block height when credentials were created (for root rotation check) */
  block_height: number;
  /** Aleo record nonce (for spending) */
  nonce: string;
  /** Plaintext ciphertext for wallet decryption */
  _record_ciphertext?: string;
};

// ----------------------------------------------------------------
// Freeze list tree (from API)
// ----------------------------------------------------------------

/** Raw freeze list tree returned by the compliance API */
export type FreezeListTree = {
  /** Current Merkle root of the freeze list */
  root: Field;
  /** Sorted list of frozen address fields */
  leaves: Field[];
  /** Tree depth (number of hash levels) */
  depth: number;
};

// ----------------------------------------------------------------
// Compliance status
// ----------------------------------------------------------------

export type ComplianceStatus =
  | "unchecked"        // haven't fetched freeze list yet
  | "clear"            // address not on freeze list
  | "frozen"           // address IS on freeze list
  | "credentials_valid" // have valid Credentials record
  | "credentials_expired" // root rotated, need new proof
  | "error";           // fetch/proof failed

export type ComplianceState = {
  status: ComplianceStatus;
  /** Formatted proof (if status is "clear") */
  proof: FreezeListProof | null;
  /** Credentials record (if status is "credentials_valid") */
  credentials: CredentialsRecord | null;
  /** Current freeze list root */
  currentRoot: Field | null;
  /** Error message (if status is "error") */
  error: string | null;
};

// ----------------------------------------------------------------
// Roster tree (client-side validation only — no on-chain primitive yet)
// ----------------------------------------------------------------
//
// NOTE: The Sealance SDK only supports exclusion proofs (freeze list).
// There is no on-chain get_roster_credentials() or roster_root mapping.
// These types are used by roster_tree_builder.ts for client-side
// pre-flight validation: verifying all manifest workers have active
// agreements before submitting chunks. Not wired to on-chain settlement.
// ----------------------------------------------------------------

/**
 * Merkle inclusion proof for a single worker in the employer's roster tree.
 * Used for client-side validation and audit trail, not on-chain verification.
 */
export type RosterInclusionProof = {
  /** Sibling hashes from leaf to root */
  path: Field[];
  /** Leaf index in the tree */
  leaf_index: number;
  /** Whether each sibling is on the left (true) or right (false) */
  directions: boolean[];
};

/**
 * The employer's roster tree — a Merkle tree over active agreement_ids.
 * Built client-side from the employer's agreement records.
 * Used for pre-flight validation before payroll submission.
 */
export type RosterTree = {
  /** Merkle root over sorted active agreement_id leaves */
  root: Field;
  /** Sorted list of active agreement_id fields (leaves) */
  leaves: Field[];
  /** Tree depth (number of hash levels) */
  depth: number;
  /** Employer address this roster belongs to */
  employer_addr: Address;
  /** Epoch second when the roster tree was built */
  built_at: number;
};
