/**
 * Chunk Planner
 *
 * Transforms a compiled PayrollRunManifest into an ordered list of
 * settlement chunks. Each chunk represents one adapter execution call.
 *
 * MVP: 1 row per chunk (canonical safety).
 * Future: 2-row micro-batches when execute_payroll_batch_2 is available.
 *
 * Chunk IDs are deterministic:
 *   chunk_id = BLAKE3("PNW::CHUNK", batch_id || u32_le(chunk_index))
 */

import type { PayrollRunManifest, ChunkPlan } from "./types";
import type { Bytes32, U128 } from "../lib/pnw-adapter/aleo_types";
import { domainHash, toHex, fromHex, DOMAIN_TAGS } from "../lib/pnw-adapter/hash";

/**
 * Plan settlement chunks for a compiled manifest.
 *
 * @param manifest - A compiled manifest (status must be "validated")
 * @param chunkSize - Rows per chunk (default 1; max 2 for batch_2)
 * @returns Ordered list of ChunkPlan objects
 */
export function planChunks(
  manifest: PayrollRunManifest,
  chunkSize: 1 | 2 = 1,
): ChunkPlan[] {
  const chunks: ChunkPlan[] = [];
  const rowCount = manifest.rows.length;

  for (let i = 0; i < rowCount; i += chunkSize) {
    const endIdx = Math.min(i + chunkSize, rowCount);
    const rowIndices: number[] = [];
    let netTotal = 0n;

    for (let j = i; j < endIdx; j++) {
      rowIndices.push(j);
      netTotal += BigInt(manifest.rows[j]!.net_amount);
    }

    const chunkIndex = chunks.length;
    const chunk_id = computeChunkId(manifest.batch_id, chunkIndex);

    chunks.push({
      chunk_index: chunkIndex,
      chunk_id,
      row_indices: rowIndices,
      net_total: netTotal.toString() as U128,
      transition:
        rowIndices.length === 1
          ? "execute_payroll"
          : "execute_payroll_batch_2",
      status: "pending",
      attempts: 0,
    });
  }

  return chunks;
}

/**
 * Compute a deterministic chunk ID.
 *
 * chunk_id = BLAKE3("PNW::CHUNK", batch_id || u32_le(chunk_index))
 */
function computeChunkId(batchId: Bytes32, chunkIndex: number): Bytes32 {
  const batchBytes = fromHex(batchId);
  const indexBytes = new Uint8Array(4);
  // Little-endian u32
  indexBytes[0] = chunkIndex & 0xff;
  indexBytes[1] = (chunkIndex >> 8) & 0xff;
  indexBytes[2] = (chunkIndex >> 16) & 0xff;
  indexBytes[3] = (chunkIndex >> 24) & 0xff;

  const data = new Uint8Array(batchBytes.length + indexBytes.length);
  data.set(batchBytes);
  data.set(indexBytes, batchBytes.length);

  return toHex(domainHash(DOMAIN_TAGS.CHUNK, data));
}
