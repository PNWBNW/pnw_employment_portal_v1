import { describe, it, expect } from "vitest";
import {
  buildRosterTreeFromAgreements,
  buildInclusionProof,
  isInRoster,
  agreementIdToLeaf,
  formatInclusionProofAsInput,
} from "./roster_tree_builder";

// Deterministic test agreement IDs (hex strings)
const AGREEMENT_A = "0x" + "aa".repeat(32);
const AGREEMENT_B = "0x" + "bb".repeat(32);
const AGREEMENT_C = "0x" + "cc".repeat(32);
const AGREEMENT_D = "0x" + "dd".repeat(32);
const EMPLOYER = "aleo1test_employer_address_placeholder";

describe("roster tree builder", () => {
  describe("buildRosterTreeFromAgreements", () => {
    it("builds a tree from a single agreement", () => {
      const tree = buildRosterTreeFromAgreements([AGREEMENT_A], EMPLOYER);
      expect(tree.leaves.length).toBe(1);
      expect(tree.root).not.toBe("0field");
      expect(tree.employer_addr).toBe(EMPLOYER);
      expect(tree.depth).toBeGreaterThanOrEqual(1);
    });

    it("builds a tree from multiple agreements", () => {
      const tree = buildRosterTreeFromAgreements(
        [AGREEMENT_A, AGREEMENT_B, AGREEMENT_C],
        EMPLOYER,
      );
      expect(tree.leaves.length).toBe(3);
      expect(tree.root).toBeTruthy();
      expect(tree.depth).toBe(2); // ceil(log2(3)) = 2
    });

    it("returns empty tree for no agreements", () => {
      const tree = buildRosterTreeFromAgreements([], EMPLOYER);
      expect(tree.leaves.length).toBe(0);
      expect(tree.root).toBe("0field");
      expect(tree.depth).toBe(0);
    });

    it("is deterministic — same inputs produce same root", () => {
      const tree1 = buildRosterTreeFromAgreements(
        [AGREEMENT_A, AGREEMENT_B],
        EMPLOYER,
      );
      const tree2 = buildRosterTreeFromAgreements(
        [AGREEMENT_A, AGREEMENT_B],
        EMPLOYER,
      );
      expect(tree1.root).toBe(tree2.root);
    });

    it("different agreements produce different roots", () => {
      const tree1 = buildRosterTreeFromAgreements(
        [AGREEMENT_A, AGREEMENT_B],
        EMPLOYER,
      );
      const tree2 = buildRosterTreeFromAgreements(
        [AGREEMENT_C, AGREEMENT_D],
        EMPLOYER,
      );
      expect(tree1.root).not.toBe(tree2.root);
    });

    it("deduplicates agreement IDs", () => {
      const tree = buildRosterTreeFromAgreements(
        [AGREEMENT_A, AGREEMENT_A, AGREEMENT_B],
        EMPLOYER,
      );
      expect(tree.leaves.length).toBe(2);
    });

    it("sorts leaves deterministically regardless of input order", () => {
      const tree1 = buildRosterTreeFromAgreements(
        [AGREEMENT_A, AGREEMENT_B, AGREEMENT_C],
        EMPLOYER,
      );
      const tree2 = buildRosterTreeFromAgreements(
        [AGREEMENT_C, AGREEMENT_A, AGREEMENT_B],
        EMPLOYER,
      );
      expect(tree1.root).toBe(tree2.root);
      expect(tree1.leaves).toEqual(tree2.leaves);
    });
  });

  describe("agreementIdToLeaf", () => {
    it("produces a field element from an agreement ID", () => {
      const leaf = agreementIdToLeaf(AGREEMENT_A);
      expect(leaf.endsWith("field")).toBe(true);
      expect(leaf.startsWith("0x")).toBe(true);
    });

    it("is deterministic", () => {
      const leaf1 = agreementIdToLeaf(AGREEMENT_A);
      const leaf2 = agreementIdToLeaf(AGREEMENT_A);
      expect(leaf1).toBe(leaf2);
    });

    it("different IDs produce different leaves", () => {
      const leaf1 = agreementIdToLeaf(AGREEMENT_A);
      const leaf2 = agreementIdToLeaf(AGREEMENT_B);
      expect(leaf1).not.toBe(leaf2);
    });
  });

  describe("isInRoster", () => {
    it("returns true for an agreement in the roster", () => {
      const tree = buildRosterTreeFromAgreements(
        [AGREEMENT_A, AGREEMENT_B],
        EMPLOYER,
      );
      expect(isInRoster(AGREEMENT_A, tree)).toBe(true);
      expect(isInRoster(AGREEMENT_B, tree)).toBe(true);
    });

    it("returns false for an agreement not in the roster", () => {
      const tree = buildRosterTreeFromAgreements(
        [AGREEMENT_A, AGREEMENT_B],
        EMPLOYER,
      );
      expect(isInRoster(AGREEMENT_C, tree)).toBe(false);
    });

    it("returns false for empty roster", () => {
      const tree = buildRosterTreeFromAgreements([], EMPLOYER);
      expect(isInRoster(AGREEMENT_A, tree)).toBe(false);
    });
  });

  describe("buildInclusionProof", () => {
    it("builds a valid inclusion proof for a member", () => {
      const tree = buildRosterTreeFromAgreements(
        [AGREEMENT_A, AGREEMENT_B, AGREEMENT_C],
        EMPLOYER,
      );
      const proof = buildInclusionProof(AGREEMENT_A, tree);
      expect(proof.path.length).toBe(tree.depth);
      expect(proof.directions.length).toBe(tree.depth);
      expect(proof.leaf_index).toBeGreaterThanOrEqual(0);
      expect(proof.leaf_index).toBeLessThan(tree.leaves.length);
    });

    it("throws for a non-member", () => {
      const tree = buildRosterTreeFromAgreements(
        [AGREEMENT_A, AGREEMENT_B],
        EMPLOYER,
      );
      expect(() => buildInclusionProof(AGREEMENT_C, tree)).toThrow(
        "not in the employer's roster tree",
      );
    });

    it("throws for empty tree", () => {
      const tree = buildRosterTreeFromAgreements([], EMPLOYER);
      expect(() => buildInclusionProof(AGREEMENT_A, tree)).toThrow(
        "empty roster tree",
      );
    });

    it("produces different proofs for different members", () => {
      const tree = buildRosterTreeFromAgreements(
        [AGREEMENT_A, AGREEMENT_B, AGREEMENT_C],
        EMPLOYER,
      );
      const proofA = buildInclusionProof(AGREEMENT_A, tree);
      const proofB = buildInclusionProof(AGREEMENT_B, tree);
      // Different leaf indices or different sibling paths
      expect(proofA.leaf_index).not.toBe(proofB.leaf_index);
    });
  });

  describe("formatInclusionProofAsInput", () => {
    it("formats proof as Aleo struct literal", () => {
      const tree = buildRosterTreeFromAgreements(
        [AGREEMENT_A, AGREEMENT_B],
        EMPLOYER,
      );
      const proof = buildInclusionProof(AGREEMENT_A, tree);
      const formatted = formatInclusionProofAsInput(proof);
      expect(formatted).toContain("path:");
      expect(formatted).toContain("leaf_index:");
      expect(formatted).toContain("u32");
    });
  });

  describe("four workers (power of 2)", () => {
    it("builds a balanced tree with depth 2", () => {
      const tree = buildRosterTreeFromAgreements(
        [AGREEMENT_A, AGREEMENT_B, AGREEMENT_C, AGREEMENT_D],
        EMPLOYER,
      );
      expect(tree.leaves.length).toBe(4);
      expect(tree.depth).toBe(2);
    });

    it("all four workers can produce inclusion proofs", () => {
      const tree = buildRosterTreeFromAgreements(
        [AGREEMENT_A, AGREEMENT_B, AGREEMENT_C, AGREEMENT_D],
        EMPLOYER,
      );
      for (const id of [AGREEMENT_A, AGREEMENT_B, AGREEMENT_C, AGREEMENT_D]) {
        const proof = buildInclusionProof(id, tree);
        expect(proof.path.length).toBe(2);
      }
    });
  });
});
