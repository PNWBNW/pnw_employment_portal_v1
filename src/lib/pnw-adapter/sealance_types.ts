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
// Roster tree (employer-scoped worker authorization)
// ----------------------------------------------------------------

/**
 * Merkle inclusion proof for a single worker in the employer's roster tree.
 * Proves "this worker IS authorized by this employer" via membership.
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

/**
 * On-chain RosterCredentials record produced by get_roster_credentials().
 * Proves the employer's roster_root was valid at a given block height.
 * Reusable for all settlement chunks in a single payroll run.
 */
export type RosterCredentialsRecord = {
  owner: Address;
  roster_root: Field;
  /** Block height when credentials were created */
  block_height: number;
  /** Aleo record nonce (for spending) */
  nonce: string;
  /** Plaintext ciphertext for wallet decryption */
  _record_ciphertext?: string;
};

export type RosterStatus =
  | "unchecked"          // haven't built roster tree yet
  | "valid"              // roster tree built, credentials acquired
  | "no_active_workers"  // employer has no active agreements
  | "credentials_expired" // roster root changed, need refresh
  | "error";

export type RosterState = {
  status: RosterStatus;
  /** The employer's roster tree */
  tree: RosterTree | null;
  /** Roster credentials record (if acquired) */
  credentials: RosterCredentialsRecord | null;
  /** Error message (if status is "error") */
  error: string | null;
};
