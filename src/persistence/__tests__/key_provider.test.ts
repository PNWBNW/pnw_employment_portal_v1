import { describe, it, expect } from "vitest";
import { SessionKeyProvider } from "../key_provider";

describe("SessionKeyProvider", () => {
  const viewKey = "AViewKey1testkey1234567890abcdef";

  it("encrypts and decrypts a round trip", async () => {
    const provider = new SessionKeyProvider(viewKey);
    const plaintext = new TextEncoder().encode('{"rows":[],"epochId":"20260315"}');

    const blob = await provider.encrypt(plaintext);
    expect(blob.iv).toBeTruthy();
    expect(blob.ciphertext).toBeTruthy();

    const decrypted = await provider.decrypt(blob);
    const decoded = new TextDecoder().decode(decrypted);
    expect(decoded).toBe('{"rows":[],"epochId":"20260315"}');
  });

  it("produces different ciphertext each time (random IV)", async () => {
    const provider = new SessionKeyProvider(viewKey);
    const plaintext = new TextEncoder().encode("same data");

    const blob1 = await provider.encrypt(plaintext);
    const blob2 = await provider.encrypt(plaintext);

    // IVs should differ (random)
    expect(blob1.iv).not.toBe(blob2.iv);
    // Ciphertext should also differ
    expect(blob1.ciphertext).not.toBe(blob2.ciphertext);
  });

  it("fails to decrypt with wrong key", async () => {
    const provider1 = new SessionKeyProvider(viewKey);
    const provider2 = new SessionKeyProvider("AViewKey1differentkey99999999999");

    const plaintext = new TextEncoder().encode("secret payroll data");
    const blob = await provider1.encrypt(plaintext);

    await expect(provider2.decrypt(blob)).rejects.toThrow();
  });

  it("fails to decrypt tampered ciphertext", async () => {
    const provider = new SessionKeyProvider(viewKey);
    const plaintext = new TextEncoder().encode("important data");
    const blob = await provider.encrypt(plaintext);

    // Tamper with ciphertext
    const tampered = { ...blob, ciphertext: blob.ciphertext.slice(0, -4) + "AAAA" };
    await expect(provider.decrypt(tampered)).rejects.toThrow();
  });

  it("throws if constructed with empty view key", () => {
    expect(() => new SessionKeyProvider("")).toThrow();
  });
});
