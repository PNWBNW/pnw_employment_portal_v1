"use client";

import { useState, useCallback } from "react";
import type { jsPDF } from "jspdf";

type Props = {
  /** Function that builds the PDF document */
  generatePdf: () => jsPDF;
  /** File name for the download (without .pdf extension) */
  fileName: string;
  /** Button label */
  label?: string;
  /** Additional CSS classes */
  className?: string;
};

/**
 * Client-side PDF download button.
 * Calls the provided generator function and triggers a browser download.
 * No data leaves the client — PDF is built entirely in-memory.
 */
export function DownloadPDFButton({
  generatePdf,
  fileName,
  label = "Download PDF",
  className,
}: Props) {
  const [generating, setGenerating] = useState(false);

  const handleClick = useCallback(() => {
    setGenerating(true);
    try {
      const doc = generatePdf();
      doc.save(`${fileName}.pdf`);
    } catch (err) {
      console.error("PDF generation failed:", err);
      alert("PDF generation failed. Check console for details.");
    } finally {
      setGenerating(false);
    }
  }, [generatePdf, fileName]);

  return (
    <button
      onClick={handleClick}
      disabled={generating}
      className={
        className ??
        "rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
      }
    >
      {generating ? "Generating..." : label}
    </button>
  );
}
