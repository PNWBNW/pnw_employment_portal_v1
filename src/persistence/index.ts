// Persistence layer — encrypted draft save/resume for payroll-in-progress
export { SessionKeyProvider } from "./key_provider";
export type { KeyProvider, EncryptedBlob } from "./key_provider";
export { encryptDraft, decryptDraft } from "./draft_encryptor";
export type { DraftPayload, DraftEnvelope } from "./draft_encryptor";
export { computeDraftIntegrity, verifyDraftIntegrity } from "./draft_integrity";
export { saveDraft, loadDraft, listDrafts, deleteDraft, deleteAllDrafts } from "./draft_store";
