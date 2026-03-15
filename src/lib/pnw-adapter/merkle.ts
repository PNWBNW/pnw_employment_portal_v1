// ============================================================
// SYNCED FILE — do not edit here
// Source: pnw_mvp_v2/portal/src/commitments/merkle.ts
// Synced from commit: pending-initial-sync
// Synced on: 2026-03-15
// If you need to change this, edit pnw_mvp_v2 first, then re-sync.
// ============================================================

import { domainHash, DOMAIN_TAGS } from "./hash";
import type { Bytes32 } from "./aleo_types";
import { fromHex, toHex } from "./hash";

export type MerkleTree = {
  leaves: Bytes32[];
  root: Bytes32;
  layers: Bytes32[][];
};

export function buildMerkleTree(leaves: Bytes32[]): MerkleTree {
  if (leaves.length === 0) throw new Error("Cannot build Merkle tree with no leaves");

  const layers: Bytes32[][] = [leaves];
  let currentLayer = leaves;

  while (currentLayer.length > 1) {
    const nextLayer: Bytes32[] = [];
    for (let i = 0; i < currentLayer.length; i += 2) {
      const left = currentLayer[i]!;
      const right = currentLayer[i + 1] ?? left; // duplicate last if odd
      const leftBytes = fromHex(left);
      const rightBytes = fromHex(right);
      const combined = new Uint8Array(leftBytes.length + rightBytes.length);
      combined.set(leftBytes);
      combined.set(rightBytes, leftBytes.length);
      nextLayer.push(toHex(domainHash(DOMAIN_TAGS.MERKLE_NODE, combined)));
    }
    layers.push(nextLayer);
    currentLayer = nextLayer;
  }

  return {
    leaves,
    root: currentLayer[0]!,
    layers,
  };
}

export function getMerkleRoot(tree: MerkleTree): Bytes32 {
  return tree.root;
}
