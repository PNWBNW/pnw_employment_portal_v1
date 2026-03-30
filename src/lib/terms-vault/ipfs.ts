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
  const blob = new Blob([encrypted.buffer as ArrayBuffer], { type: "application/octet-stream" });
  const formData = new FormData();
  formData.append("file", blob, `terms_${agreementId.slice(0, 16)}.enc`);
  formData.append("agreementId", agreementId);

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
