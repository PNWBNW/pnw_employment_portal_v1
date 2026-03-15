import { describe, it, expect } from "vitest";
import { domainHash, toHex, fromHex, DOMAIN_TAGS } from "./hash";

describe("hash utilities", () => {
  it("domainHash produces 32-byte output", () => {
    const data = new TextEncoder().encode("test data");
    const result = domainHash(DOMAIN_TAGS.DOC, data);
    expect(result).toBeInstanceOf(Uint8Array);
    expect(result.length).toBe(32);
  });

  it("toHex produces 0x-prefixed lowercase hex", () => {
    const bytes = new Uint8Array([0xab, 0xcd, 0xef]);
    const hex = toHex(bytes);
    expect(hex).toBe("0xabcdef");
  });

  it("fromHex parses 0x-prefixed hex", () => {
    const bytes = fromHex("0xabcdef");
    expect(bytes).toEqual(new Uint8Array([0xab, 0xcd, 0xef]));
  });

  it("fromHex parses hex without prefix", () => {
    const bytes = fromHex("abcdef");
    expect(bytes).toEqual(new Uint8Array([0xab, 0xcd, 0xef]));
  });

  it("roundtrip: toHex(fromHex(x)) === x", () => {
    const original = "0x0123456789abcdef";
    expect(toHex(fromHex(original))).toBe(original);
  });

  it("same input produces same hash (deterministic)", () => {
    const data = new TextEncoder().encode("determinism test");
    const h1 = toHex(domainHash(DOMAIN_TAGS.INPUTS, data));
    const h2 = toHex(domainHash(DOMAIN_TAGS.INPUTS, data));
    expect(h1).toBe(h2);
  });

  it("different domains produce different hashes", () => {
    const data = new TextEncoder().encode("same data");
    const h1 = toHex(domainHash(DOMAIN_TAGS.DOC, data));
    const h2 = toHex(domainHash(DOMAIN_TAGS.LEAF, data));
    expect(h1).not.toBe(h2);
  });
});
