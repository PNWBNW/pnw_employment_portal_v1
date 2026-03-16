// ---------------------------------------------------------------------------
// Draft Store — IndexedDB persistence for encrypted payroll drafts.
// The employer can close their browser, come back days later, enter their
// view key, and resume exactly where they left off.
//
// Storage layout:
//   Database: "pnw_drafts"
//   Object store: "drafts" (keyPath: "draftId")
//   Indexes: "by_employer" (employerAddr), "by_epoch" (epochId)
//
// All stored values are DraftEnvelope objects — the blob field is encrypted.
// No plaintext wages, names, or addresses are stored in IndexedDB.
// ---------------------------------------------------------------------------

import type { DraftEnvelope } from "./draft_encryptor";

const DB_NAME = "pnw_drafts";
const DB_VERSION = 1;
const STORE_NAME = "drafts";

/**
 * Open (or create) the IndexedDB database.
 */
function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "draftId" });
        store.createIndex("by_employer", "employerAddr", { unique: false });
        store.createIndex("by_epoch", "epochId", { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Save an encrypted draft envelope to IndexedDB.
 * Overwrites any existing draft with the same draftId.
 */
export async function saveDraft(envelope: DraftEnvelope): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(envelope);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Load a single draft by ID.
 * Returns null if not found.
 */
export async function loadDraft(
  draftId: string,
): Promise<DraftEnvelope | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const request = tx.objectStore(STORE_NAME).get(draftId);
    request.onsuccess = () => resolve((request.result as DraftEnvelope) ?? null);
    request.onerror = () => reject(request.error);
  });
}

/**
 * List all drafts for a given employer address.
 * Returns envelope metadata (draftId, epochId, rowCount, savedAt) — the
 * blob is included but cannot be read without decryption.
 */
export async function listDrafts(
  employerAddr: string,
): Promise<DraftEnvelope[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const index = tx.objectStore(STORE_NAME).index("by_employer");
    const request = index.getAll(employerAddr);
    request.onsuccess = () =>
      resolve((request.result as DraftEnvelope[]) ?? []);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Delete a draft by ID.
 */
export async function deleteDraft(draftId: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(draftId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Delete all drafts for an employer. Use on full payroll reset.
 */
export async function deleteAllDrafts(employerAddr: string): Promise<void> {
  const drafts = await listDrafts(employerAddr);
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    for (const draft of drafts) {
      store.delete(draft.draftId);
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
