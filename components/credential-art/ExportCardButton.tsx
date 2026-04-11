"use client";

/**
 * ExportCardButton — downloads the rendered credential card as a PNG.
 *
 * Takes a CredentialCardHandle ref and a filename; on click, grabs the
 * canvas blob and triggers a browser download.
 */

import { useState, type RefObject } from "react";
import type { CredentialCardHandle } from "./CredentialCard";

type Props = {
  cardRef: RefObject<CredentialCardHandle | null>;
  fileName: string;
  label?: string;
  className?: string;
};

export function ExportCardButton({
  cardRef,
  fileName,
  label = "Download Image",
  className,
}: Props) {
  const [busy, setBusy] = useState(false);

  async function handleClick() {
    if (!cardRef.current) return;
    setBusy(true);
    try {
      const blob = await cardRef.current.exportPng();
      if (!blob) return;

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName.endsWith(".png") ? fileName : `${fileName}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy}
      className={
        className ??
        "rounded-md border border-input px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent hover:text-accent-foreground disabled:opacity-50"
      }
    >
      {busy ? "Exporting..." : label}
    </button>
  );
}
