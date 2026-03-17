import { describe, it, expect } from "vitest";
import { encryptDraft, decryptDraft } from "../draft_encryptor";
import { SessionKeyProvider } from "../key_provider";
import type { PayrollTableRow } from "@/components/payroll-table/types";

function makeRow(overrides: Partial<PayrollTableRow> = {}): PayrollTableRow {
  return {
    id: crypto.randomUUID(),
    worker_name: "Bob",
    worker_addr: "aleo1bob456",
    worker_name_hash: "0xcafe",
    agreement_id: "agreement_010",
    epoch_id: "20260315",
    gross_amount: "3000.00",
    tax_withheld: "450.00",
    fee_amount: "30.00",
    net_amount: "2520.00",
    resolved: false,
    ...overrides,
  };
}

describe("draft_encryptor", () => {
  const viewKey = "AViewKey1encryptortest1234567890";
  const employer = "aleo1employer";
  const epochId = "20260315";

  it("encrypts and decrypts a draft round trip", async () => {
    const provider = new SessionKeyProvider(viewKey);
    const rows = [makeRow(), makeRow({ agreement_id: "agreement_011" })];

    const envelope = await encryptDraft(rows, epochId, employer, provider);

    expect(envelope.draftId).toBeTruthy();
    expect(envelope.employerAddr).toBe(employer);
    expect(envelope.epochId).toBe(epochId);
    expect(envelope.rowCount).toBe(2);
    expect(envelope.blob.ciphertext).toBeTruthy();

    const payload = await decryptDraft(envelope, provider);

    expect(payload.rows).toHaveLength(2);
    expect(payload.epochId).toBe(epochId);
    expect(payload.employerAddr).toBe(employer);
    expect(payload.integrityRoot.startsWith("0x")).toBe(true);
  });

  it("preserves an existing draft ID on re-save", async () => {
    const provider = new SessionKeyProvider(viewKey);
    const rows = [makeRow()];

    const first = await encryptDraft(rows, epochId, employer, provider);
    const second = await encryptDraft(
      rows,
      epochId,
      employer,
      provider,
      first.draftId,
    );

    expect(second.draftId).toBe(first.draftId);
  });

  it("fails decryption with wrong key", async () => {
    const provider1 = new SessionKeyProvider(viewKey);
    const provider2 = new SessionKeyProvider("AViewKey1wrongkey999999999999999");
    const rows = [makeRow()];

    const envelope = await encryptDraft(rows, epochId, employer, provider1);
    await expect(decryptDraft(envelope, provider2)).rejects.toThrow();
  });

  it("detects tampered row data after decryption", async () => {
    const provider = new SessionKeyProvider(viewKey);
    const rows = [makeRow()];

    const envelope = await encryptDraft(rows, epochId, employer, provider);

    // Decrypt raw, tamper with the JSON, re-encrypt with same key
    const rawBytes = await provider.decrypt(envelope.blob);
    const json = JSON.parse(new TextDecoder().decode(rawBytes));
    json.rows[0].gross_amount = "99999.00"; // tamper
    // Don't update integrityRoot — this should be caught
    const tamperedBytes = new TextEncoder().encode(JSON.stringify(json));
    const tamperedBlob = await provider.encrypt(tamperedBytes);

    const tamperedEnvelope = { ...envelope, blob: tamperedBlob };

    await expect(decryptDraft(tamperedEnvelope, provider)).rejects.toThrow(
      /integrity/i,
    );
  });
});
