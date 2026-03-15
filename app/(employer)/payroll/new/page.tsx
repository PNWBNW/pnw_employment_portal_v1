"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import Link from "next/link";
import { PayrollTable } from "@/components/payroll-table/PayrollTable";
import { PayrollTableToolbar } from "@/components/payroll-table/PayrollTableToolbar";
import { PayrollTableValidation } from "@/components/payroll-table/PayrollTableValidation";
import { ManifestPreview } from "@/components/payroll-table/ManifestPreview";
import type { PayrollTableRow } from "@/components/payroll-table/types";
import { createEmptyRow, parseDollar, formatDollar } from "@/components/payroll-table/types";
import { validateTable } from "@/components/payroll-table/validation";
import { useWorkerStore } from "@/src/stores/worker_store";
import { useSessionStore } from "@/src/stores/session_store";
import { usePayrollRunStore } from "@/src/stores/payroll_run_store";
import { compileManifest } from "@/src/manifest/compiler";
import { planChunks } from "@/src/manifest/chunk_planner";
import { VERSIONS } from "@/src/config/programs";
import { domainHash, toHex, DOMAIN_TAGS } from "@/src/lib/pnw-adapter/hash";
import type { PayrollRunManifest } from "@/src/manifest/types";
import type { ChunkPlan } from "@/src/manifest/types";

const DRAFT_STORAGE_KEY = "pnw_payroll_draft";

/** Get today's date as YYYYMMDD */
function todayEpoch(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

export default function NewPayrollPage() {
  const [rows, setRows] = useState<PayrollTableRow[]>([]);
  const [epochId, setEpochId] = useState(todayEpoch);
  const [draftSaved, setDraftSaved] = useState(false);
  const [compiledManifest, setCompiledManifest] = useState<PayrollRunManifest | null>(null);
  const [compiledChunks, setCompiledChunks] = useState<ChunkPlan[]>([]);
  const [compileError, setCompileError] = useState<string | null>(null);
  const workers = useWorkerStore((s) => s.workers);
  const address = useSessionStore((s) => s.address);
  const setManifest = usePayrollRunStore((s) => s.setManifest);
  const updateChunks = usePayrollRunStore((s) => s.updateChunks);

  // Restore draft from sessionStorage on mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = sessionStorage.getItem(DRAFT_STORAGE_KEY);
    if (!raw) return;
    try {
      const parsed: unknown = JSON.parse(raw);
      if (
        typeof parsed === "object" &&
        parsed !== null &&
        "rows" in parsed &&
        "epochId" in parsed
      ) {
        const draft = parsed as { rows: PayrollTableRow[]; epochId: string };
        setRows(draft.rows);
        setEpochId(draft.epochId);
      }
    } catch {
      sessionStorage.removeItem(DRAFT_STORAGE_KEY);
    }
  }, []);

  // Validation
  const { rowResults, allValid } = useMemo(
    () => validateTable(rows),
    [rows],
  );

  // Row management
  const addRow = useCallback(
    (row: PayrollTableRow) => {
      // Pre-fill with worker data if available
      if (workers.length > 0 && !row.worker_addr) {
        const nextWorker = workers.find(
          (w) =>
            w.status === "active" &&
            !rows.some((r) => r.agreement_id === w.agreement_id),
        );
        if (nextWorker) {
          row.worker_name = nextWorker.display_name ?? "";
          row.worker_addr = nextWorker.worker_addr;
          row.worker_name_hash = nextWorker.worker_name_hash;
          row.agreement_id = nextWorker.agreement_id;
        }
      }
      setRows((prev) => [...prev, row]);
      setDraftSaved(false);
    },
    [workers, rows],
  );

  const importRows = useCallback((imported: PayrollTableRow[]) => {
    setRows((prev) => [...prev, ...imported]);
    setDraftSaved(false);
  }, []);

  const updateRow = useCallback(
    (index: number, field: keyof PayrollTableRow, value: string) => {
      setRows((prev) => {
        const updated = [...prev];
        const row = updated[index];
        if (!row) return prev;
        const newRow = { ...row, [field]: value };

        // Auto-calculate net when gross/tax/fee change
        if (
          field === "gross_amount" ||
          field === "tax_withheld" ||
          field === "fee_amount"
        ) {
          const gross = parseDollar(
            field === "gross_amount" ? value : newRow.gross_amount,
          );
          const tax = parseDollar(
            field === "tax_withheld" ? value : newRow.tax_withheld,
          );
          const fee = parseDollar(
            field === "fee_amount" ? value : newRow.fee_amount,
          );
          if (!isNaN(gross) && !isNaN(tax) && !isNaN(fee)) {
            newRow.net_amount = formatDollar(gross - tax - fee);
          }
        }

        updated[index] = newRow;
        return updated;
      });
      setDraftSaved(false);
    },
    [],
  );

  const removeRow = useCallback((index: number) => {
    setRows((prev) => prev.filter((_, i) => i !== index));
    setDraftSaved(false);
  }, []);

  const clearAll = useCallback(() => {
    setRows([]);
    setDraftSaved(false);
    sessionStorage.removeItem(DRAFT_STORAGE_KEY);
  }, []);

  const saveDraft = useCallback(() => {
    if (typeof window === "undefined") return;
    sessionStorage.setItem(
      DRAFT_STORAGE_KEY,
      JSON.stringify({ rows, epochId }),
    );
    setDraftSaved(true);
    setTimeout(() => setDraftSaved(false), 2000);
  }, [rows, epochId]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">
            New Payroll Run
          </h1>
          <p className="text-sm text-muted-foreground">
            Build your payroll table and send payments
          </p>
        </div>
        <Link
          href="/payroll"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          Cancel
        </Link>
      </div>

      {/* Toolbar */}
      <PayrollTableToolbar
        rows={rows}
        onAddRow={addRow}
        onImportRows={importRows}
        onSaveDraft={saveDraft}
        onClearAll={clearAll}
        allValid={allValid}
        epochId={epochId}
        onEpochChange={setEpochId}
      />

      {/* Draft saved indicator */}
      {draftSaved && (
        <p className="text-xs text-green-600 dark:text-green-400">
          Draft saved to session.
        </p>
      )}

      {/* Table */}
      <PayrollTable
        rows={rows}
        onUpdateRow={updateRow}
        onRemoveRow={removeRow}
        validationResults={rowResults}
      />

      {/* Validation errors */}
      <PayrollTableValidation validationResults={rowResults} />

      {/* Compile error */}
      {compileError && (
        <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
          <p className="font-medium">Compilation Error</p>
          <pre className="mt-1 whitespace-pre-wrap text-xs">{compileError}</pre>
        </div>
      )}

      {/* Manifest Preview */}
      {compiledManifest && (
        <ManifestPreview
          manifest={compiledManifest}
          chunks={compiledChunks}
          onCancel={() => {
            setCompiledManifest(null);
            setCompiledChunks([]);
          }}
          onConfirm={() => {
            // Store manifest in payroll run store and navigate to run page
            setManifest(compiledManifest);
            updateChunks(compiledChunks);
            // E5: will navigate to run status page
            alert(
              `Manifest queued! Batch ID: ${compiledManifest.batch_id.slice(0, 18)}…\nSettlement Coordinator coming in Phase E5.`,
            );
          }}
        />
      )}

      {/* Action buttons */}
      {rows.length > 0 && !compiledManifest && (
        <div className="flex items-center justify-between border-t border-border pt-4">
          <p className="text-sm text-muted-foreground">
            {rows.length} row{rows.length !== 1 ? "s" : ""} ·{" "}
            {allValid ? "Ready to compile" : "Fix validation errors first"}
          </p>
          <div className="flex gap-2">
            <button
              disabled={!allValid || rows.length === 0}
              className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
              title={
                allValid
                  ? "Compile manifest and preview"
                  : "Fix validation errors first"
              }
              onClick={() => {
                setCompileError(null);
                try {
                  // Compute a deterministic employer_name_hash from address
                  const employerNameHash = address
                    ? toHex(domainHash(DOMAIN_TAGS.DOC, new TextEncoder().encode(address)))
                    : "0x0000000000000000000000000000000000000000000000000000000000000000";

                  // Apply epoch_id from toolbar to all rows
                  const rowsWithEpoch = rows.map((r) => ({
                    ...r,
                    epoch_id: epochId,
                  }));

                  const manifest = compileManifest({
                    rows: rowsWithEpoch,
                    employer_addr: address ?? "aleo1unknown",
                    employer_name_hash: employerNameHash,
                    epoch_id: epochId,
                    schema_v: VERSIONS.schema_v,
                    calc_v: VERSIONS.calc_v,
                    policy_v: VERSIONS.policy_v,
                  });

                  const chunks = planChunks(manifest);
                  setCompiledManifest(manifest);
                  setCompiledChunks(chunks);
                } catch (err) {
                  setCompileError(
                    err instanceof Error ? err.message : "Compilation failed",
                  );
                }
              }}
            >
              Validate & Preview Manifest
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
