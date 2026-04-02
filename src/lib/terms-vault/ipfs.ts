/**
 * Terms Vault — IPFS storage via Pinata REST API.
 *
 * Upload: server-side only (via /api/terms/upload route, hides Pinata JWT)
 * Fetch: client-side via public IPFS gateway
 */

const IPFS_GATEWAY = "https://gateway.pinata.cloud/ipfs";

/**
 * Upload encrypted terms to IPFS via our API route.
 * Returns the IPFS CID (content hash).
 */
export async function uploadEncryptedTerms(
  encrypted: Uint8Array,
  agreementId: string,
): Promise<string> {
  // Normalize: strip 0x prefix for consistent lookup
  const cleanId = agreementId.startsWith("0x") ? agreementId.slice(2) : agreementId;
  const blob = new Blob([encrypted.buffer as ArrayBuffer], { type: "application/octet-stream" });
  const formData = new FormData();
  formData.append("file", blob, `terms_${cleanId.slice(0, 16)}.enc`);
  formData.append("agreementId", cleanId);

  const response = await fetch("/api/terms/upload", {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Upload failed: ${response.status} ${text}`);
  }

  const data = (await response.json()) as { cid: string };
  return data.cid;
}

/**
 * Look up the IPFS CID for an agreement's encrypted terms.
 * Uses our server-side API which queries Pinata by metadata.
 */
export async function lookupTermsCid(agreementId: string): Promise<string | null> {
  // Normalize: strip 0x prefix for consistent lookup
  const cleanId = agreementId.startsWith("0x") ? agreementId.slice(2) : agreementId;
  try {
    const response = await fetch(
      `/api/terms/lookup?agreementId=${encodeURIComponent(cleanId)}`,
      { signal: AbortSignal.timeout(15_000) },
    );

    if (!response.ok) return null;

    const data = (await response.json()) as { cid?: string };
    return data.cid ?? null;
  } catch {
    return null;
  }
}

/**
 * Fetch encrypted terms from IPFS by CID.
 * Returns the raw encrypted bytes.
 */
export async function fetchEncryptedTerms(cid: string): Promise<Uint8Array> {
  const response = await fetch(`${IPFS_GATEWAY}/${cid}`, {
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    throw new Error(`IPFS fetch failed: ${response.status}`);
  }

  const buffer = await response.arrayBuffer();
  return new Uint8Array(buffer);
}
