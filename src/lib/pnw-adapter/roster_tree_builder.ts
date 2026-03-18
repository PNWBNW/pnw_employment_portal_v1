/**
 * Roster Tree Builder
 *
 * Builds an employer-scoped Merkle tree over active agreement_ids.
 * This is the "roster" — the set of workers authorized to receive payroll
 * from this employer.
 *
 * Pattern mirrors freeze_list_resolver.ts but for INCLUSION proofs:
 * - Freeze list: "prove address is NOT on the blocklist" (exclusion)
 * - Roster tree: "prove worker IS on the employer's roster" (inclusion)
 *
 * The roster tree is built client-side from the employer's agreement records.
 * The roster_root is anchored on-chain via get_roster_credentials(), producing
 * a reusable RosterCredentials record for all settlement chunks in a run.
 *
 * Leaf computation:
 *   roster_leaf = BLAKE3("PNW::ROSTER_LEAF", agreement_id_bytes)
 *
 * Tree construction:
 *   Sorted leaves → binary Merkle tree with MERKLE_NODE domain tag.
 */

import type { Address, Bytes32, Field } from "./aleo_types";
import type { RosterTree, RosterInclusionProof } from "./sealance_types";
import { domainHash, toHex, DOMAIN_TAGS } from "./hash";
import { readAgreementRecords } from "@/src/records/agreement_reader";

// ----------------------------------------------------------------
// Public API
// ----------------------------------------------------------------

/**
 * Build the employer's roster tree from their active agreements.
 *
 * @param viewKey - Employer's view key (for reading agreement records)
 * @param employerAddr - Employer's Aleo address
 * @returns RosterTree with root, sorted leaves, and depth
 */
export async function buildRosterTree(
  viewKey: string,
  employerAddr: Address,
): Promise<RosterTree> {
  // Fetch all agreement records for this employer
  const workerRecords = await readAgreementRecords(viewKey, employerAddr);

  // Filter to active agreements only
  const activeRecords = workerRecords.filter((r) => r.status === "active");

  if (activeRecords.length === 0) {
    return {
      root: "0field",
      leaves: [],
      depth: 0,
      employer_addr: employerAddr,
      built_at: Math.floor(Date.now() / 1000),
    };
  }

  // Convert agreement_ids to roster leaves
  const leaves = activeRecords
    .map((r) => agreementIdToLeaf(r.agreement_id))
    .sort(compareFields);

  // Build the Merkle tree
  const depth = Math.ceil(Math.log2(Math.max(leaves.length, 2)));
  const paddedLeaves = padLeaves(leaves, depth);
  const root = computeMerkleRoot(paddedLeaves);

  return {
    root,
    leaves,
    depth,
    employer_addr: employerAddr,
    built_at: Math.floor(Date.now() / 1000),
  };
}

/**
 * Build a roster tree from a pre-fetched list of agreement IDs.
 * Used when the caller already has the agreement list (e.g. from manifest rows).
 */
export function buildRosterTreeFromAgreements(
  agreementIds: Bytes32[],
  employerAddr: Address,
): RosterTree {
  if (agreementIds.length === 0) {
    return {
      root: "0field",
      leaves: [],
      depth: 0,
      employer_addr: employerAddr,
      built_at: Math.floor(Date.now() / 1000),
    };
  }

  const leaves = agreementIds
    .map((id) => agreementIdToLeaf(id))
    .sort(compareFields);

  // Deduplicate (same worker can't have two identical agreement_ids,
  // but defensive against bugs)
  const uniqueLeaves = deduplicateFields(leaves);

  const depth = Math.ceil(Math.log2(Math.max(uniqueLeaves.length, 2)));
  const paddedLeaves = padLeaves(uniqueLeaves, depth);
  const root = computeMerkleRoot(paddedLeaves);

  return {
    root,
    leaves: uniqueLeaves,
    depth,
    employer_addr: employerAddr,
    built_at: Math.floor(Date.now() / 1000),
  };
}

/**
 * Build a Merkle inclusion proof for a specific agreement_id in the roster.
 *
 * @throws if the agreement_id is NOT in the roster tree
 */
export function buildInclusionProof(
  agreementId: Bytes32,
  tree: RosterTree,
): RosterInclusionProof {
  if (tree.leaves.length === 0) {
    throw new Error("Cannot build inclusion proof for empty roster tree");
  }

  const targetLeaf = agreementIdToLeaf(agreementId);
  const leafIndex = tree.leaves.findIndex(
    (l) => fieldToBigInt(l) === fieldToBigInt(targetLeaf),
  );

  if (leafIndex === -1) {
    throw new Error(
      `Agreement ${agreementId} is not in the employer's roster tree`,
    );
  }

  const paddedLeaves = padLeaves(tree.leaves, tree.depth);
  return buildSiblingPath(paddedLeaves, leafIndex, tree.depth);
}

/**
 * Check if an agreement_id is in the roster tree.
 */
export function isInRoster(agreementId: Bytes32, tree: RosterTree): boolean {
  if (tree.leaves.length === 0) return false;
  const targetLeaf = agreementIdToLeaf(agreementId);
  const targetBig = fieldToBigInt(targetLeaf);
  return tree.leaves.some((l) => fieldToBigInt(l) === targetBig);
}

/**
 * Convert an agreement_id to a roster leaf field element.
 * roster_leaf = BLAKE3("PNW::ROSTER_LEAF", agreement_id_bytes)
 */
export function agreementIdToLeaf(agreementId: Bytes32): Field {
  const bytes = new TextEncoder().encode(agreementId);
  const hash = domainHash(DOMAIN_TAGS.ROSTER_LEAF, bytes);
  return toHex(hash) + "field";
}

/**
 * Format a roster inclusion proof as Aleo transaction input.
 */
export function formatInclusionProofAsInput(proof: RosterInclusionProof): string {
  const pathStr = proof.path.map((f) => f).join(", ");
  return `{ path: [${pathStr}], leaf_index: ${proof.leaf_index}u32 }`;
}

// ----------------------------------------------------------------
// Internal: Merkle tree operations
// ----------------------------------------------------------------

function computeMerkleRoot(leaves: Field[]): Field {
  if (leaves.length === 0) return "0field";
  if (leaves.length === 1) return leaves[0]!;

  let currentLevel = leaves;

  while (currentLevel.length > 1) {
    const nextLevel: Field[] = [];
    for (let i = 0; i < currentLevel.length; i += 2) {
      const left = currentLevel[i]!;
      const right = currentLevel[i + 1] ?? left;
      nextLevel.push(hashPair(left, right));
    }
    currentLevel = nextLevel;
  }

  return currentLevel[0]!;
}

function buildSiblingPath(
  leaves: Field[],
  leafIndex: number,
  depth: number,
): RosterInclusionProof {
  const path: Field[] = [];
  const directions: boolean[] = [];

  let currentLevel = leaves;
  let idx = leafIndex;

  for (let level = 0; level < depth; level++) {
    const siblingIdx = idx % 2 === 0 ? idx + 1 : idx - 1;
    const isLeft = idx % 2 === 1;

    const sibling =
      siblingIdx < currentLevel.length ? currentLevel[siblingIdx]! : "0field";

    path.push(sibling);
    directions.push(isLeft);

    // Compute next level
    const nextLevel: Field[] = [];
    for (let i = 0; i < currentLevel.length; i += 2) {
      const left = currentLevel[i]!;
      const right =
        i + 1 < currentLevel.length ? currentLevel[i + 1]! : "0field";
      nextLevel.push(hashPair(left, right));
    }
    currentLevel = nextLevel;
    idx = Math.floor(idx / 2);
  }

  return { path, leaf_index: leafIndex, directions };
}

function hashPair(left: Field, right: Field): Field {
  const leftBytes = new TextEncoder().encode(left);
  const rightBytes = new TextEncoder().encode(right);
  const combined = new Uint8Array(leftBytes.length + rightBytes.length);
  combined.set(leftBytes, 0);
  combined.set(rightBytes, leftBytes.length);
  return toHex(domainHash(DOMAIN_TAGS.MERKLE_NODE, combined)) + "field";
}

function padLeaves(leaves: Field[], depth: number): Field[] {
  const size = Math.pow(2, depth);
  const padded = [...leaves];
  while (padded.length < size) {
    padded.push("0field");
  }
  return padded;
}

function fieldToBigInt(field: Field): bigint {
  const cleaned = field.replace("field", "").replace("0x", "");
  return BigInt(cleaned.startsWith("0x") ? cleaned : `0x${cleaned}`);
}

function compareFields(a: Field, b: Field): number {
  const aBig = fieldToBigInt(a);
  const bBig = fieldToBigInt(b);
  return aBig < bBig ? -1 : aBig > bBig ? 1 : 0;
}

function deduplicateFields(sorted: Field[]): Field[] {
  if (sorted.length <= 1) return sorted;
  const result: Field[] = [sorted[0]!];
  for (let i = 1; i < sorted.length; i++) {
    if (fieldToBigInt(sorted[i]!) !== fieldToBigInt(sorted[i - 1]!)) {
      result.push(sorted[i]!);
    }
  }
  return result;
}
