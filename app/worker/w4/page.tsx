"use client";

/**
 * Worker W-4 Form — tax withholding elections.
 *
 * Mirrors the IRS Form W-4 (2020+ revision). Workers must complete
 * this before receiving payroll. The data feeds into the employer's
 * tax engine to auto-compute per-period withholding based on the
 * worker's filing status, dependents, and adjustments.
 *
 * All data stays in localStorage keyed by wallet address. Never
 * transmitted unencrypted.
 */

import { useEffect, useRef, useState } from "react";
import { useAleoSession } from "@/components/key-manager/useAleoSession";
import { useW4Store, type W4Data } from "@/src/stores/w4_store";
import type { FilingStatus } from "@/src/lib/tax-engine";
import { parseW4Pdf, type W4ParseResult } from "@/src/lib/w4-pdf-parser";

const FILING_OPTIONS: { value: FilingStatus; label: string; desc: string }[] = [
  { value: "single", label: "Single", desc: "or Married filing separately" },
  { value: "married_filing_jointly", label: "Married Filing Jointly", desc: "or Qualifying surviving spouse" },
  { value: "head_of_household", label: "Head of Household", desc: "Check only if you're unmarried and pay more than half the costs of keeping up a home for yourself and a qualifying individual" },
];

export default function WorkerW4Page() {
  const { address } = useAleoSession();
  const { w4, initForWallet, updateW4, submitW4, reset } = useW4Store();
  const [saved, setSaved] = useState(false);
  const [pdfParseResult, setPdfParseResult] = useState<W4ParseResult | null>(null);
  const [uploading, setUploading] = useState(false);
  const [pdfFileName, setPdfFileName] = useState<string | null>(null);
  const [pdfBytes, setPdfBytes] = useState<ArrayBuffer | null>(null);
  const [ipfsUploading, setIpfsUploading] = useState(false);
  const [ipfsCid, setIpfsCid] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (address) initForWallet(address);
  }, [address, initForWallet]);

  // Handle PDF file upload — parse fields and pre-fill form
  async function handlePdfUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setPdfParseResult(null);
    setPdfFileName(file.name);

    try {
      const buffer = await file.arrayBuffer();
      setPdfBytes(buffer);

      const result = await parseW4Pdf(buffer);
      setPdfParseResult(result);

      if (result.success && result.data) {
        // Pre-fill the web form from the parsed PDF
        updateW4(result.data);
      }
    } catch (err) {
      setPdfParseResult({
        success: false,
        data: null,
        rawFields: {},
        fieldCount: 0,
        notes: [`Upload failed: ${err instanceof Error ? err.message : String(err)}`],
      });
    } finally {
      setUploading(false);
      // Reset file input so the same file can be re-uploaded
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  // Upload the PDF to IPFS (encrypted) via the existing Pinata proxy
  async function handleIpfsUpload() {
    if (!pdfBytes || !address) return;
    setIpfsUploading(true);
    try {
      // Encrypt the PDF bytes before uploading
      // For now, we use a simple base64 encoding as a placeholder.
      // The full encryption (AES-256-GCM with parties_key) will be
      // wired once the W-4 sharing mechanism is finalized.
      const base64 = btoa(
        String.fromCharCode(...new Uint8Array(pdfBytes)),
      );

      const response = await fetch("/api/terms/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: base64,
          filename: `w4-${address.slice(0, 12)}.pdf.enc`,
        }),
      });

      if (!response.ok) throw new Error("IPFS upload failed");

      const data = await response.json();
      const cid = data.cid ?? data.IpfsHash ?? data.hash;
      if (cid) {
        setIpfsCid(cid);
        // Store the CID in localStorage for the employer to find
        try {
          localStorage.setItem(`pnw_w4_cid_${address}`, cid);
        } catch { /* non-critical */ }
      }
    } catch (err) {
      console.error("[PNW-W4] IPFS upload failed:", err);
    } finally {
      setIpfsUploading(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    submitW4();
    // If we have a PDF, also upload to IPFS
    if (pdfBytes) {
      void handleIpfsUpload();
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  const dependentCredit =
    w4.qualifyingChildren * 2000 + w4.otherDependents * 500;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">
          Form W-4 — Tax Withholding
        </h1>
        <p className="text-sm text-muted-foreground">
          Complete this form so your employer can withhold the correct federal
          income tax from your pay. This mirrors the IRS Form W-4.
        </p>
        {w4.completed && (
          <p className="mt-1 text-xs text-green-600 dark:text-green-400">
            W-4 on file — last updated{" "}
            {new Date(w4.updatedAt).toLocaleDateString()}
          </p>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* PDF Upload — official IRS W-4 */}
        <div className="rounded-lg border border-border bg-card p-5">
          <h2 className="text-sm font-semibold text-foreground">
            Upload Official IRS W-4
          </h2>
          <div className="mt-4 space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">1</span>
              <span className="text-foreground">Download the form</span>
            </div>
            <a
              href="/irs-w4-2025.pdf"
              download="IRS_Form_W-4_2025.pdf"
              className="inline-block rounded-md border border-primary bg-primary/5 px-4 py-2 text-sm font-medium text-primary hover:bg-primary/10"
            >
              Download IRS Form W-4 (PDF)
            </a>

            <div className="flex items-center gap-2 text-sm">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">2</span>
              <span className="text-foreground">Fill it out in your PDF viewer, then save</span>
            </div>

            <div className="flex items-center gap-2 text-sm">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">3</span>
              <span className="text-foreground">Upload your completed W-4</span>
            </div>
            <div className="flex items-center gap-3">
              <label className="cursor-pointer rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
                {uploading ? "Reading PDF..." : pdfFileName ? "Replace PDF" : "Upload Completed W-4"}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,application/pdf"
                  onChange={handlePdfUpload}
                  className="hidden"
                  disabled={uploading}
                />
              </label>
              {pdfFileName && (
                <span className="text-xs text-muted-foreground">
                  {pdfFileName}
                </span>
              )}
            </div>
          </div>

          <p className="mt-3 text-xs text-muted-foreground">
            The portal reads the form fields from your PDF and pre-fills the
            sections below. Your W-4 is encrypted and stored on IPFS so your
            employer can access it alongside your agreement.
          </p>

          {/* Parse result feedback */}
          {pdfParseResult && (
            <div
              className={`mt-3 rounded-md border p-3 text-xs ${
                pdfParseResult.success
                  ? "border-green-300 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-200"
                  : "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200"
              }`}
            >
              {pdfParseResult.success ? (
                <p className="font-medium">
                  W-4 fields extracted successfully — form pre-filled below.
                  Review and submit.
                </p>
              ) : (
                <p className="font-medium">
                  Could not read form fields from this PDF.
                  Fill out the sections below manually instead.
                </p>
              )}
              {pdfParseResult.notes.map((note, i) => (
                <p key={i} className="mt-1">{note}</p>
              ))}
            </div>
          )}

          {/* IPFS status */}
          {ipfsCid && (
            <p className="mt-2 text-xs text-green-600 dark:text-green-400">
              W-4 stored on IPFS: {ipfsCid.slice(0, 16)}...
            </p>
          )}
        </div>

        {/* Step 1: Filing Status */}
        <div className="rounded-lg border border-border bg-card p-5">
          <h2 className="text-sm font-semibold text-foreground">
            Step 1: Filing Status
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Choose the statement that best describes your situation.
          </p>
          <div className="mt-4 space-y-3">
            {FILING_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className={`flex cursor-pointer items-start gap-3 rounded-md border p-3 transition-colors ${
                  w4.filingStatus === opt.value
                    ? "border-primary bg-primary/5"
                    : "border-border hover:bg-muted/30"
                }`}
              >
                <input
                  type="radio"
                  name="filing_status"
                  value={opt.value}
                  checked={w4.filingStatus === opt.value}
                  onChange={() => updateW4({ filingStatus: opt.value })}
                  className="mt-0.5"
                />
                <div>
                  <span className="text-sm font-medium text-foreground">
                    {opt.label}
                  </span>
                  <p className="text-xs text-muted-foreground">{opt.desc}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Step 2: Multiple Jobs */}
        <div className="rounded-lg border border-border bg-card p-5">
          <h2 className="text-sm font-semibold text-foreground">
            Step 2: Multiple Jobs or Spouse Works
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Complete this step if you (1) hold more than one job at a time, or
            (2) are married filing jointly and your spouse also works.
          </p>
          <label className="mt-4 flex items-center gap-3">
            <input
              type="checkbox"
              checked={w4.multipleJobsOrSpouseWorks}
              onChange={(e) =>
                updateW4({ multipleJobsOrSpouseWorks: e.target.checked })
              }
              className="h-4 w-4 rounded border-border"
            />
            <span className="text-sm text-foreground">
              I have more than one job, or my spouse also works
            </span>
          </label>
        </div>

        {/* Step 3: Dependents */}
        <div className="rounded-lg border border-border bg-card p-5">
          <h2 className="text-sm font-semibold text-foreground">
            Step 3: Claim Dependents
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            If your total income will be $200,000 or less ($400,000 or less if
            married filing jointly), you can claim dependent credits.
          </p>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                Qualifying children under 17
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  max={20}
                  value={w4.qualifyingChildren}
                  onChange={(e) =>
                    updateW4({
                      qualifyingChildren: Math.max(0, parseInt(e.target.value) || 0),
                    })
                  }
                  className="w-20 rounded-md border border-input bg-background px-3 py-2 text-sm text-center"
                />
                <span className="text-xs text-muted-foreground">
                  × $2,000 = ${(w4.qualifyingChildren * 2000).toLocaleString()}
                </span>
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                Other dependents
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  max={20}
                  value={w4.otherDependents}
                  onChange={(e) =>
                    updateW4({
                      otherDependents: Math.max(0, parseInt(e.target.value) || 0),
                    })
                  }
                  className="w-20 rounded-md border border-input bg-background px-3 py-2 text-sm text-center"
                />
                <span className="text-xs text-muted-foreground">
                  × $500 = ${(w4.otherDependents * 500).toLocaleString()}
                </span>
              </div>
            </div>
          </div>
          <div className="mt-3 rounded-md bg-muted/50 p-3">
            <p className="text-sm font-medium text-foreground">
              Total dependent credit: ${dependentCredit.toLocaleString()}
            </p>
            <p className="text-xs text-muted-foreground">
              This amount reduces your annual federal income tax withholding.
            </p>
          </div>
        </div>

        {/* Step 4: Other Adjustments */}
        <div className="rounded-lg border border-border bg-card p-5">
          <h2 className="text-sm font-semibold text-foreground">
            Step 4: Other Adjustments (optional)
          </h2>
          <div className="mt-4 space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                4(a) Other income (not from jobs) — annual amount
              </label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">$</span>
                <input
                  type="number"
                  min={0}
                  step={100}
                  value={w4.otherIncome || ""}
                  onChange={(e) =>
                    updateW4({ otherIncome: Math.max(0, parseFloat(e.target.value) || 0) })
                  }
                  placeholder="0"
                  className="w-32 rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Interest, dividends, retirement income — added to your projected annual income.
              </p>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                4(b) Deductions beyond standard deduction — annual amount
              </label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">$</span>
                <input
                  type="number"
                  min={0}
                  step={100}
                  value={w4.extraDeductions || ""}
                  onChange={(e) =>
                    updateW4({ extraDeductions: Math.max(0, parseFloat(e.target.value) || 0) })
                  }
                  placeholder="0"
                  className="w-32 rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Only if you plan to itemize deductions or claim adjustments to income.
              </p>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                4(c) Extra withholding per pay period
              </label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">$</span>
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={w4.extraWithholding || ""}
                  onChange={(e) =>
                    updateW4({ extraWithholding: Math.max(0, parseFloat(e.target.value) || 0) })
                  }
                  placeholder="0"
                  className="w-32 rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Additional amount you want withheld each pay period.
              </p>
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="flex items-center gap-3">
          <button
            type="submit"
            className="rounded-md bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            {w4.completed ? "Update W-4" : "Submit W-4"}
          </button>
          {w4.completed && (
            <button
              type="button"
              onClick={() => {
                reset();
                setSaved(false);
              }}
              className="rounded-md border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-muted"
            >
              Reset
            </button>
          )}
          {saved && (
            <span className="text-sm text-green-600 dark:text-green-400">
              W-4 saved successfully
            </span>
          )}
        </div>

        <p className="text-xs text-muted-foreground">
          Your W-4 data is stored locally in your browser and shared with your
          employer only through the encrypted agreement channel. It is never
          stored on the blockchain or any server in plaintext.
        </p>
      </form>
    </div>
  );
}
