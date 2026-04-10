"use client";

/**
 * CredentialCard — React wrapper around the Canvas topo renderer.
 *
 * Accepts either a full CredentialRecord (production usage) or a raw
 * preview input (seed + credential_type + display info) for the dev preview
 * page.
 */

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import {
  deriveTerrainParams,
  type TerrainParams,
} from "@/src/nft-art/hash_params";
import {
  renderTopoCard,
  CARD_WIDTH,
  CARD_HEIGHT,
  type CredentialCardInfo,
} from "@/src/nft-art/topo_renderer";
import {
  CREDENTIAL_TYPE_LABELS,
  type CredentialRecord,
  type CredentialType,
  type CredentialStatus,
} from "@/src/stores/credential_store";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type BaseProps = {
  workerName: string; // e.g. "pnw_dao.pnw"
  width?: number;
  height?: number;
  className?: string;
};

type FromRecordProps = BaseProps & {
  credential: CredentialRecord;
};

type FromPreviewProps = BaseProps & {
  /** Any 32-byte hash input: 0x-hex, decimal field element, or Uint8Array */
  seed: string | bigint | Uint8Array;
  credentialType: CredentialType;
  scope: string;
  status: CredentialStatus;
  /** Optional fingerprint display; defaults to first 10 chars of hex seed */
  fingerprint?: string;
};

export type CredentialCardProps = FromRecordProps | FromPreviewProps;

function isFromRecord(p: CredentialCardProps): p is FromRecordProps {
  return "credential" in p;
}

// ---------------------------------------------------------------------------
// Ref API
// ---------------------------------------------------------------------------

export type CredentialCardHandle = {
  /** Returns the canvas element (for PNG export, etc.) */
  getCanvas: () => HTMLCanvasElement | null;
  /** Convenience: export the card as a PNG blob */
  exportPng: () => Promise<Blob | null>;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function fingerprintFromSeed(
  seed: string | bigint | Uint8Array,
): string {
  if (typeof seed === "string") {
    const trimmed = seed.trim();
    if (trimmed.startsWith("0x")) return trimmed.slice(0, 10);
    // Decimal — show first few digits
    if (/^\d+$/.test(trimmed)) return `#${trimmed.slice(0, 8)}`;
    return trimmed.slice(0, 10);
  }
  if (typeof seed === "bigint") return `#${seed.toString().slice(0, 8)}`;
  // Uint8Array — show first 4 bytes as hex
  const bytes = Array.from(seed.slice(0, 4));
  return "0x" + bytes.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export const CredentialCard = forwardRef<CredentialCardHandle, CredentialCardProps>(
  function CredentialCard(props, ref) {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const width = props.width ?? CARD_WIDTH;
    const height = props.height ?? CARD_HEIGHT;

    useImperativeHandle(ref, () => ({
      getCanvas: () => canvasRef.current,
      exportPng: async () => {
        const canvas = canvasRef.current;
        if (!canvas) return null;
        return new Promise((resolve) => {
          canvas.toBlob((blob) => resolve(blob), "image/png");
        });
      },
    }));

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      let params: TerrainParams;
      let info: CredentialCardInfo;

      if (isFromRecord(props)) {
        const { credential } = props;
        params = deriveTerrainParams(
          credential.credential_id,
          credential.credential_type,
        );
        info = {
          workerName: props.workerName,
          credentialType: credential.credential_type,
          credentialTypeLabel:
            credential.credential_type_label ||
            CREDENTIAL_TYPE_LABELS[credential.credential_type],
          scope: credential.scope,
          status: credential.status,
          fingerprint: credential.credential_id.slice(0, 10),
        };
      } else {
        params = deriveTerrainParams(props.seed, props.credentialType);
        info = {
          workerName: props.workerName,
          credentialType: props.credentialType,
          credentialTypeLabel: CREDENTIAL_TYPE_LABELS[props.credentialType],
          scope: props.scope,
          status: props.status,
          fingerprint: props.fingerprint ?? fingerprintFromSeed(props.seed),
        };
      }

      renderTopoCard(canvas, params, info);
    }, [props]);

    // Desaturate revoked credentials visually
    const isRevoked =
      isFromRecord(props)
        ? props.credential.status === "revoked"
        : props.status === "revoked";

    return (
      <canvas
        ref={canvasRef}
        width={CARD_WIDTH}
        height={CARD_HEIGHT}
        style={{
          width,
          height,
          display: "block",
          borderRadius: 8,
          filter: isRevoked ? "grayscale(0.6) opacity(0.7)" : undefined,
        }}
        className={props.className}
      />
    );
  },
);
