/**
 * Punch IPFS Storage — encrypted punch records on Pinata.
 *
 * Individual punches are encrypted and pinned to IPFS with metadata tags
 * (worker address + week ID). On page load, we query Pinata for all pins
 * matching the worker's current week to reconstruct state — no browser
 * storage needed.
 *
 * Uses the same Pinata proxy infrastructure as agreement terms and W-4 data.
 */

import type { Address } from "@/src/lib/pnw-adapter/aleo_types";
import type { EncryptedPunchEnvelope, PunchData } from "./types";
import { encryptPunch, decryptPunch } from "./punch_crypto";

// ---------------------------------------------------------------------------
// Week ID computation
// ---------------------------------------------------------------------------

/**
 * Compute ISO week identifier and bounds for a given date.
 * Returns e.g. { weekId: "2026-W19", monday: "2026-05-04", sunday: "2026-05-10" }
 */
export function getWeekBounds(date: Date = new Date()): {
  weekId: string;
  monday: string;
  sunday: string;
} {
  const d = new Date(date);
  const day = d.getDay();
  // Shift to Monday = 0
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d);
  monday.setDate(diff);
  monday.setHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  // ISO week number
  const jan1 = new Date(monday.getFullYear(), 0, 1);
  const weekNum = Math.ceil(
    ((monday.getTime() - jan1.getTime()) / 86_400_000 + jan1.getDay() + 1) / 7,
  );

  const pad = (n: number) => n.toString().padStart(2, "0");
  const fmt = (dt: Date) =>
    `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;

  return {
    weekId: `${monday.getFullYear()}-W${weekNum.toString().padStart(2, "0")}`,
    monday: fmt(monday),
    sunday: fmt(sunday),
  };
}

// ---------------------------------------------------------------------------
// Upload a punch to IPFS
// ---------------------------------------------------------------------------

/**
 * Encrypt a punch and pin it to IPFS via the Pinata proxy.
 * Returns the IPFS CID.
 *
 * The punch is tagged with metadata so we can query for all punches
 * belonging to a specific worker + week without decrypting.
 */
export async function uploadPunch(
  punch: PunchData,
  employerAddress: Address,
  workerAddress: Address,
): Promise<string> {
  const envelope = await encryptPunch(punch, employerAddress, workerAddress);
  const { weekId } = getWeekBounds(new Date(punch.timestamp));

  const response = await fetch("/api/timekeeping/upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      envelope,
      workerAddress,
      weekId,
      punchType: punch.punchType,
      date: punch.date,
    }),
  });

  if (!response.ok) {
    throw new Error(`Punch IPFS upload failed: ${response.statusText}`);
  }

  const data = await response.json();
  return data.cid as string;
}

// ---------------------------------------------------------------------------
// Fetch punches for a week from IPFS
// ---------------------------------------------------------------------------

/**
 * Query Pinata for all encrypted punches belonging to a worker for a given week.
 * Then fetch and decrypt each one.
 *
 * This is the state recovery mechanism — called on page mount instead of
 * reading from localStorage.
 */
export async function fetchWeekPunches(
  workerAddress: Address,
  employerAddress: Address,
  weekId?: string,
): Promise<PunchData[]> {
  const week = weekId ?? getWeekBounds().weekId;

  // Step 1: Get list of punch CIDs for this worker + week
  const listResponse = await fetch(
    `/api/timekeeping/list?worker=${encodeURIComponent(workerAddress)}&week=${encodeURIComponent(week)}`,
  );

  if (!listResponse.ok) {
    if (listResponse.status === 404) return []; // No punches yet
    throw new Error(`Punch list fetch failed: ${listResponse.statusText}`);
  }

  const { pins } = (await listResponse.json()) as {
    pins: { cid: string; metadata: Record<string, string> }[];
  };

  if (!pins || pins.length === 0) return [];

  // Step 2: Fetch and decrypt each punch
  const punches: PunchData[] = [];

  for (const pin of pins) {
    try {
      const fetchResponse = await fetch(
        `/api/terms/lookup?cid=${encodeURIComponent(pin.cid)}`,
      );
      if (!fetchResponse.ok) continue;

      const envelopeJson = await fetchResponse.text();
      const envelope: EncryptedPunchEnvelope = JSON.parse(envelopeJson);
      const punch = await decryptPunch(envelope, employerAddress, workerAddress);
      punches.push(punch);
    } catch (err) {
      console.error("[PNW-TK] Failed to decrypt punch:", pin.cid, err);
    }
  }

  // Sort by timestamp ascending
  punches.sort((a, b) => a.timestamp - b.timestamp);
  return punches;
}
