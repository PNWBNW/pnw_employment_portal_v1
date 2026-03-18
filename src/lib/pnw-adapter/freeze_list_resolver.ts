/**
 * Freeze List Resolver
 *
 * Fetches the compliance freeze list tree from the on-chain freezelist program,
 * builds Merkle exclusion proofs for a given address, and formats them for
 * Aleo transaction inputs.
 *
 * The freeze list is a separate program (test_usdcx_freezelist.aleo on testnet,
 * usad_freezelist.aleo on mainnet). The stablecoin program imports it and checks
 * proofs in finalize.
 *
 * Non-membership proof: for an address NOT in the tree, find the two adjacent
 * leaves that surround it. The two sibling paths prove the gap where the
 * address would be — proving it's not there.
 */

import { ENV } from "@/src/config/env";
import { PROGRAMS } from "@/src/config/programs";
import type { Address, Field } from "./aleo_types";
import type { FreezeListTree, FreezeListProof, MerkleSiblingPath } from "./sealance_types";
import { domainHash, toHex, DOMAIN_TAGS } from "./hash";

// ----------------------------------------------------------------
// Public API
// ----------------------------------------------------------------

/**
 * Fetch the current freeze list tree from the on-chain program.
 * Queries the freezelist program's mappings to reconstruct the tree.
 */
export async function fetchFreezeListTree(): Promise<FreezeListTree> {
  const endpoint = ENV.ALEO_ENDPOINT;
  const freezelistProgram = PROGRAMS.external.usdcx_freezelist;

  // Fetch the current root
  const rootResponse = await fetchMapping(
    endpoint,
    freezelistProgram,
    "freeze_list_root",
    "1u8",
  );

  if (!rootResponse) {
    // No freeze list exists yet — empty tree
    return { root: "0field", leaves: [], depth: 0 };
  }

  const root = cleanField(rootResponse);

  // Fetch the leaf count
  const countResponse = await fetchMapping(
    endpoint,
    freezelistProgram,
    "freeze_list_count",
    "1u8",
  );

  const leafCount = countResponse ? parseInt(cleanField(countResponse), 10) : 0;

  if (leafCount === 0) {
    return { root, leaves: [], depth: 0 };
  }

  // Fetch all leaves (frozen addresses as field elements)
  const leaves: Field[] = [];
  for (let i = 0; i < leafCount; i++) {
    const leaf = await fetchMapping(
      endpoint,
      freezelistProgram,
      "freeze_list",
      `${i}u32`,
    );
    if (leaf) {
      leaves.push(cleanField(leaf));
    }
  }

  // Sort leaves for binary search
  leaves.sort((a, b) => {
    const aBig = BigInt(a.replace("field", ""));
    const bBig = BigInt(b.replace("field", ""));
    return aBig < bBig ? -1 : aBig > bBig ? 1 : 0;
  });

  const depth = Math.ceil(Math.log2(Math.max(leafCount, 2)));

  return { root, leaves, depth };
}

/**
 * Convert an Aleo address to a field element for tree comparison.
 * Uses BLAKE3 domain-tagged hash matching the on-chain conversion.
 */
export function addressToField(address: Address): Field {
  const bytes = new TextEncoder().encode(address);
  const hash = domainHash(DOMAIN_TAGS.NAME, bytes);
  return toHex(hash) + "field";
}

/**
 * Check if an address is on the freeze list.
 */
export function isAddressFrozen(
  address: Address,
  tree: FreezeListTree,
): boolean {
  if (tree.leaves.length === 0) return false;

  const targetField = addressToField(address);
  const targetBig = fieldToBigInt(targetField);

  return tree.leaves.some((leaf) => fieldToBigInt(leaf) === targetBig);
}

/**
 * Build a Merkle exclusion proof for an address NOT in the freeze list.
 *
 * Finds the two adjacent leaves surrounding the target's position,
 * then builds sibling paths for both.
 *
 * @throws if the address IS on the freeze list
 */
export function buildExclusionProof(
  address: Address,
  tree: FreezeListTree,
): FreezeListProof {
  if (tree.leaves.length === 0) {
    // Empty tree — trivial proof with sentinel values
    return {
      proof_low: emptySiblingPath(tree.depth),
      proof_high: emptySiblingPath(tree.depth),
    };
  }

  const targetField = addressToField(address);
  const targetBig = fieldToBigInt(targetField);

  // Find insertion point (where target would be if added)
  const insertIdx = findInsertionIndex(tree.leaves, targetBig);

  // Check target isn't actually in the list
  if (insertIdx < tree.leaves.length) {
    const atIdx = fieldToBigInt(tree.leaves[insertIdx]!);
    if (atIdx === targetBig) {
      throw new Error(
        `Address ${address} is on the freeze list — cannot build exclusion proof`,
      );
    }
  }

  // Adjacent leaves: low = insertIdx - 1, high = insertIdx
  // Handle edge cases (target is below all leaves or above all leaves)
  const lowIdx = Math.max(0, insertIdx - 1);
  const highIdx = Math.min(tree.leaves.length - 1, insertIdx);

  // Pad leaves to next power of 2 for balanced tree
  const paddedLeaves = padLeaves(tree.leaves, tree.depth);

  const proof_low = buildSiblingPath(paddedLeaves, lowIdx, tree.depth);
  const proof_high = buildSiblingPath(paddedLeaves, highIdx, tree.depth);

  return { proof_low, proof_high };
}

/**
 * Format a FreezeListProof as Aleo transaction inputs.
 * Produces the [MerkleProof; 2u32] array format.
 */
export function formatProofAsInputs(proof: FreezeListProof): string[] {
  return [
    formatSingleProof(proof.proof_low),
    formatSingleProof(proof.proof_high),
  ];
}

// ----------------------------------------------------------------
// Internal: Merkle tree operations
// ----------------------------------------------------------------

function buildSiblingPath(
  leaves: Field[],
  leafIndex: number,
  depth: number,
): MerkleSiblingPath {
  const path: Field[] = [];
  const directions: boolean[] = [];

  // Build tree level by level
  let currentLevel = leaves;
  let idx = leafIndex;

  for (let level = 0; level < depth; level++) {
    // Sibling index
    const siblingIdx = idx % 2 === 0 ? idx + 1 : idx - 1;
    const isLeft = idx % 2 === 1; // sibling is on the left if we're odd

    const sibling = siblingIdx < currentLevel.length
      ? currentLevel[siblingIdx]!
      : zeroField();

    path.push(sibling);
    directions.push(isLeft);

    // Move up: compute parent level
    const nextLevel: Field[] = [];
    for (let i = 0; i < currentLevel.length; i += 2) {
      const left = currentLevel[i]!;
      const right = i + 1 < currentLevel.length ? currentLevel[i + 1]! : zeroField();
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
    padded.push(zeroField());
  }
  return padded;
}

function emptySiblingPath(depth: number): MerkleSiblingPath {
  const d = Math.max(depth, 1);
  return {
    path: Array.from({ length: d }, () => zeroField()),
    leaf_index: 0,
    directions: Array.from({ length: d }, () => false),
  };
}

function zeroField(): Field {
  return "0field";
}

function fieldToBigInt(field: Field): bigint {
  const cleaned = field.replace("field", "").replace("0x", "");
  return BigInt(cleaned.startsWith("0x") ? cleaned : `0x${cleaned}`);
}

function findInsertionIndex(sortedLeaves: Field[], target: bigint): number {
  let lo = 0;
  let hi = sortedLeaves.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (fieldToBigInt(sortedLeaves[mid]!) < target) {
      lo = mid + 1;
    } else {
      hi = mid;
    }
  }
  return lo;
}

function formatSingleProof(proof: MerkleSiblingPath): string {
  // Format as Aleo struct literal
  const pathStr = proof.path.map((f) => f).join(", ");
  return `{ path: [${pathStr}], leaf_index: ${proof.leaf_index}u32 }`;
}

// ----------------------------------------------------------------
// Network helpers
// ----------------------------------------------------------------

async function fetchMapping(
  endpoint: string,
  program: string,
  mapping: string,
  key: string,
): Promise<string | null> {
  try {
    const url = `${endpoint}/program/${program}/mapping/${mapping}/${key}`;
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return null;
    const data: unknown = await response.json();
    return typeof data === "string" ? data : null;
  } catch {
    return null;
  }
}

function cleanField(raw: string): string {
  return raw.replace(/\.(private|public)$/, "").trim();
}
