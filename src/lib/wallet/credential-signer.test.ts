import { describe, it, expect, vi } from "vitest";
import {
  generateChallenge,
  requestWalletSignature,
  buildSigningMessage,
} from "./credential-signer";

const TEST_ADDRESS = "aleo1test_address_0001";
const TEST_CRED_ID = "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890";
const TEST_AUTH_ID = "0x1111111111111111111111111111111111111111111111111111111111111111";
const TEST_AGREEMENT_ID = "0x2222222222222222222222222222222222222222222222222222222222222222";

describe("generateChallenge", () => {
  it("generates a deterministic challenge for credential context", () => {
    const ts = 1710000000;
    const a = generateChallenge(
      { type: "credential", credential_id: TEST_CRED_ID },
      TEST_ADDRESS,
      ts,
    );
    const b = generateChallenge(
      { type: "credential", credential_id: TEST_CRED_ID },
      TEST_ADDRESS,
      ts,
    );
    expect(a.challengeHex).toBe(b.challengeHex);
    expect(a.timestamp).toBe(ts);
    expect(a.challengeHex).toMatch(/^0x[0-9a-f]{64}$/);
  });

  it("generates different challenges for different credential IDs", () => {
    const ts = 1710000000;
    const a = generateChallenge(
      { type: "credential", credential_id: TEST_CRED_ID },
      TEST_ADDRESS,
      ts,
    );
    const b = generateChallenge(
      { type: "credential", credential_id: TEST_AUTH_ID },
      TEST_ADDRESS,
      ts,
    );
    expect(a.challengeHex).not.toBe(b.challengeHex);
  });

  it("generates different challenges for different signers", () => {
    const ts = 1710000000;
    const a = generateChallenge(
      { type: "credential", credential_id: TEST_CRED_ID },
      "aleo1signer_a",
      ts,
    );
    const b = generateChallenge(
      { type: "credential", credential_id: TEST_CRED_ID },
      "aleo1signer_b",
      ts,
    );
    expect(a.challengeHex).not.toBe(b.challengeHex);
  });

  it("generates different challenges for different timestamps", () => {
    const a = generateChallenge(
      { type: "credential", credential_id: TEST_CRED_ID },
      TEST_ADDRESS,
      1710000000,
    );
    const b = generateChallenge(
      { type: "credential", credential_id: TEST_CRED_ID },
      TEST_ADDRESS,
      1710000001,
    );
    expect(a.challengeHex).not.toBe(b.challengeHex);
  });

  it("generates different challenges for different context types", () => {
    const ts = 1710000000;
    const a = generateChallenge(
      { type: "credential", credential_id: TEST_CRED_ID },
      TEST_ADDRESS,
      ts,
    );
    const b = generateChallenge(
      { type: "audit", auth_id: TEST_CRED_ID },
      TEST_ADDRESS,
      ts,
    );
    expect(a.challengeHex).not.toBe(b.challengeHex);
  });

  it("works for audit context", () => {
    const { challengeHex, challengeBytes } = generateChallenge(
      { type: "audit", auth_id: TEST_AUTH_ID },
      TEST_ADDRESS,
      1710000000,
    );
    expect(challengeHex).toMatch(/^0x[0-9a-f]{64}$/);
    expect(challengeBytes).toBeInstanceOf(Uint8Array);
    expect(challengeBytes.length).toBe(32);
  });

  it("works for agreement context", () => {
    const { challengeHex } = generateChallenge(
      { type: "agreement", agreement_id: TEST_AGREEMENT_ID },
      TEST_ADDRESS,
      1710000000,
    );
    expect(challengeHex).toMatch(/^0x[0-9a-f]{64}$/);
  });

  it("uses current timestamp if none provided", () => {
    const before = Math.floor(Date.now() / 1000);
    const { timestamp } = generateChallenge(
      { type: "credential", credential_id: TEST_CRED_ID },
      TEST_ADDRESS,
    );
    const after = Math.floor(Date.now() / 1000);
    expect(timestamp).toBeGreaterThanOrEqual(before);
    expect(timestamp).toBeLessThanOrEqual(after);
  });
});

describe("requestWalletSignature", () => {
  it("calls signMessage with the challenge bytes and returns proof", async () => {
    const mockSignature = new Uint8Array(64).fill(0xab);
    const mockSignMessage = vi.fn().mockResolvedValue(mockSignature);

    const proof = await requestWalletSignature(
      mockSignMessage,
      { type: "credential", credential_id: TEST_CRED_ID },
      TEST_ADDRESS,
    );

    expect(mockSignMessage).toHaveBeenCalledOnce();
    expect(mockSignMessage).toHaveBeenCalledWith(expect.any(Uint8Array));
    expect(proof.challenge).toMatch(/^0x[0-9a-f]{64}$/);
    expect(proof.signature).toMatch(/^0x[0-9a-f]+$/);
    expect(proof.signer).toBe(TEST_ADDRESS);
    expect(proof.context.type).toBe("credential");
    expect(proof.timestamp).toBeGreaterThan(0);
  });

  it("propagates signMessage errors", async () => {
    const mockSignMessage = vi
      .fn()
      .mockRejectedValue(new Error("User rejected"));

    await expect(
      requestWalletSignature(
        mockSignMessage,
        { type: "audit", auth_id: TEST_AUTH_ID },
        TEST_ADDRESS,
      ),
    ).rejects.toThrow("User rejected");
  });
});

describe("buildSigningMessage", () => {
  it("builds credential consent message", () => {
    const msg = buildSigningMessage({
      type: "credential",
      credential_id: TEST_CRED_ID,
    });
    expect(msg).toContain("Credential Consent");
    expect(msg).toContain(TEST_CRED_ID);
    expect(msg).toContain("private key never leaves");
  });

  it("builds audit consent message", () => {
    const msg = buildSigningMessage({
      type: "audit",
      auth_id: TEST_AUTH_ID,
    });
    expect(msg).toContain("Audit Authorization");
    expect(msg).toContain(TEST_AUTH_ID);
  });

  it("builds agreement consent message", () => {
    const msg = buildSigningMessage({
      type: "agreement",
      agreement_id: TEST_AGREEMENT_ID,
    });
    expect(msg).toContain("Agreement Acceptance");
    expect(msg).toContain(TEST_AGREEMENT_ID);
  });
});
