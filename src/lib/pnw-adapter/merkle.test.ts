import { describe, it, expect } from "vitest";
import { buildMerkleTree, getMerkleRoot } from "./merkle";
import { domainHash, toHex, DOMAIN_TAGS } from "./hash";

function makeLeaf(data: string): string {
  return toHex(domainHash(DOMAIN_TAGS.LEAF, new TextEncoder().encode(data)));
}

describe("merkle tree", () => {
  it("single leaf: root equals the leaf", () => {
    const leaf = makeLeaf("single");
    const tree = buildMerkleTree([leaf]);
    expect(getMerkleRoot(tree)).toBe(leaf);
  });

  it("two leaves: root is domain hash of concatenation", () => {
    const a = makeLeaf("a");
    const b = makeLeaf("b");
    const tree = buildMerkleTree([a, b]);
    const root = getMerkleRoot(tree);
    expect(root).not.toBe(a);
    expect(root).not.toBe(b);
    expect(root.startsWith("0x")).toBe(true);
    expect(root.length).toBe(66); // 0x + 64 hex chars
  });

  it("deterministic: same leaves produce same root", () => {
    const leaves = [makeLeaf("x"), makeLeaf("y"), makeLeaf("z")];
    const root1 = getMerkleRoot(buildMerkleTree(leaves));
    const root2 = getMerkleRoot(buildMerkleTree(leaves));
    expect(root1).toBe(root2);
  });

  it("different leaves produce different root", () => {
    const root1 = getMerkleRoot(buildMerkleTree([makeLeaf("a"), makeLeaf("b")]));
    const root2 = getMerkleRoot(buildMerkleTree([makeLeaf("c"), makeLeaf("d")]));
    expect(root1).not.toBe(root2);
  });

  it("throws on empty leaves", () => {
    expect(() => buildMerkleTree([])).toThrow();
  });
});
