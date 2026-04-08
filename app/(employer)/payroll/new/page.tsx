"use client";

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PayrollTable } from "@/components/payroll-table/PayrollTable";
import { PayrollTableToolbar } from "@/components/payroll-table/PayrollTableToolbar";
import { PayrollTableValidation } from "@/components/payroll-table/PayrollTableValidation";
import { ManifestPreview } from "@/components/payroll-table/ManifestPreview";
import type { PayrollTableRow } from "@/components/payroll-table/types";
import { createEmptyRow, parseDollar, formatDollar } from "@/components/payroll-table/types";
import { validateTable } from "@/components/payroll-table/validation";
import { applyWorkerToRow, resolveWorker } from "@/components/payroll-table/worker_resolver";
import { useWorkerStore } from "@/src/stores/worker_store";
import type { WorkerRecord } from "@/src/stores/worker_store";
import { useSessionStore } from "@/src/stores/session_store";
import { usePayrollRunStore } from "@/src/stores/payroll_run_store";
import { compileManifest } from "@/src/manifest/compiler";
import { planChunks } from "@/src/manifest/chunk_planner";
import { VERSIONS } from "@/src/config/programs";
import { domainHash, toHex, DOMAIN_TAGS } from "@/src/lib/pnw-adapter/hash";
import type { PayrollRunManifest, PayrollRunStatus } from "@/src/manifest/types";
import type { ChunkPlan } from "@/src/manifest/types";
import {
  executeSettlement,
  type CoordinatorCallbacks,
} from "@/src/coordinator/settlement_coordinator";
import { getPrivateKey } from "@/src/stores/session_store";
import { ENV } from "@/src/config/env";
import { useWallet } from "@provablehq/aleo-wallet-adaptor-react";
import { scanAgreementRecords, readAgreementRecords } from "@/src/records/agreement_reader";
import {
  SessionKeyProvider,
  encryptDraft,
  decryptDraft,
  saveDraft as saveDraftToDb,
  listDrafts,
  deleteDraft,
} from "@/src/persistence";
import type { DraftEnvelope } from "@/src/persistence";

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
  const [draftSaveMsg, setDraftSaveMsg] = useState<string | null>(null);
  const [savedDrafts, setSavedDrafts] = useState<DraftEnvelope[]>([]);
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);
  const [compiledManifest, setCompiledManifest] = useState<PayrollRunManifest | null>(null);
  const [compiledChunks, setCompiledChunks] = useState<ChunkPlan[]>([]);
  const [compileError, setCompileError] = useState<string | null>(null);
  const [isSettling, setIsSettling] = useState(false);
  const [settlementStatus, setSettlementStatus] = useState<string | null>(null);
  const workers = useWorkerStore((s) => s.workers);
  const setWorkers = useWorkerStore((s) => s.setWorkers);
  const address = useSessionStore((s) => s.address);
  const viewKey = useSessionStore((s) => s.viewKey);
  const { requestRecords } = useWallet();
  const setManifest = usePayrollRunStore((s) => s.setManifest);
  const updateChunks = usePayrollRunStore((s) => s.updateChunks);
  const updateStatus = usePayrollRunStore((s) => s.updateStatus);
  const router = useRouter();
  const settlingRef = useRef(false);

  // Load workers from on-chain agreement records if the store is empty
  useEffect(() => {
    if (workers.length > 0 || !address) return;
    (async () => {
      let records = requestRecords
        ? await scanAgreementRecords(requestRecords, address)
        : [];
      if (records.length === 0 && viewKey) {
        records = await readAgreementRecords(viewKey, address);
      }
      if (records.length > 0) setWorkers(records);
    })().catch(() => {});
  }, [viewKey, address, requestRecords, workers.length, setWorkers]);

  // Restore draft from sessionStorage on mount (fast, same-tab recovery)
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

  // Load list of encrypted drafts from IndexedDB when session is available
  useEffect(() => {
    if (!address) return;
    listDrafts(address).then(setSavedDrafts).catch(() => {});
  }, [address]);

  // Validation
  const { rowResults, allValid } = useMemo(
    () => validateTable(rows),
    [rows],
  );

  // --- Worker selection handler ---
  const selectWorker = useCallback(
    (index: number, worker: WorkerRecord) => {
      setRows((prev) => {
        const updated = [...prev];
        const row = updated[index];
        if (!row) return prev;

        const resolved = applyWorkerToRow(row, worker);

        // Recalculate net with existing amounts
        const gross = parseDollar(resolved.gross_amount);
        const tax = parseDollar(resolved.tax_withheld);
        const fee = parseDollar(resolved.fee_amount);
        if (!isNaN(gross) && !isNaN(tax) && !isNaN(fee)) {
          resolved.net_amount = formatDollar(gross - tax - fee);
        }

        updated[index] = resolved;
        return updated;
      });
      setDraftSaved(false);
    },
    [],
  );

  // Row management
  const addRow = useCallback(
    (row: PayrollTableRow) => {
      // If there's only one active worker not yet used, auto-resolve
      const usedAgreements = new Set(rows.map((r) => r.agreement_id).filter(Boolean));
      const availableWorkers = workers.filter(
        (w) => w.status === "active" && !usedAgreements.has(w.agreement_id),
      );
      if (availableWorkers.length === 1) {
        const worker = availableWorkers[0]!;
        row = applyWorkerToRow(row, worker);
      }
      setRows((prev) => [...prev, row]);
      setDraftSaved(false);
    },
    [workers, rows],
  );

  const importRows = useCallback(
    (imported: PayrollTableRow[]) => {
      // Try to resolve worker names from the imported data
      const resolvedImported = imported.map((row) => {
        if (row.worker_name && !row.resolved) {
          const match = resolveWorker(row.worker_name, workers, [], row.id);
          if (match) {
            return applyWorkerToRow(row, match);
          }
        }
        return row;
      });
      setRows((prev) => [...prev, ...resolvedImported]);
      setDraftSaved(false);
    },
    [workers],
  );

  const updateRow = useCallback(
    (index: number, field: keyof PayrollTableRow, value: string) => {
      setRows((prev) => {
        const updated = [...prev];
        const row = updated[index];
        if (!row) return prev;
        const newRow = { ...row, [field]: value };

        // If worker_name changed, try to auto-resolve
        if (field === "worker_name") {
          const match = resolveWorker(value, workers, updated, row.id);
          if (match) {
            Object.assign(newRow, {
              worker_addr: match.worker_addr,
              worker_name_hash: match.worker_name_hash,
              agreement_id: match.agreement_id,
              resolved: true,
            });
          } else {
            // Clear resolution if name no longer matches
            newRow.resolved = false;
            newRow.worker_addr = "";
            newRow.worker_name_hash = "";
            newRow.agreement_id = "";
          }
        }

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
    [workers],
  );

  const removeRow = useCallback((index: number) => {
    setRows((prev) => prev.filter((_, i) => i !== index));
    setDraftSaved(false);
  }, []);

  const clearAll = useCallback(() => {
    setRows([]);
    setDraftSaved(false);
    setActiveDraftId(null);
    sessionStorage.removeItem(DRAFT_STORAGE_KEY);
  }, []);

  // Save draft to sessionStorage (fast, same-tab) AND encrypted IndexedDB (cross-session)
  const saveDraft = useCallback(async () => {
    if (typeof window === "undefined") return;

    // Always save to sessionStorage for same-tab recovery
    sessionStorage.setItem(
      DRAFT_STORAGE_KEY,
      JSON.stringify({ rows, epochId }),
    );

    // If we have a view key, also save encrypted to IndexedDB
    if (viewKey && address) {
      try {
        const keyProvider = new SessionKeyProvider(viewKey);
        const envelope = await encryptDraft(
          rows,
          epochId,
          address,
          keyProvider,
          activeDraftId ?? undefined,
        );
        await saveDraftToDb(envelope);
        setActiveDraftId(envelope.draftId);
        // Refresh draft list
        const drafts = await listDrafts(address);
        setSavedDrafts(drafts);
        setDraftSaveMsg("Draft encrypted and saved");
      } catch (err) {
        setDraftSaveMsg(
          `Session saved. Encrypted save failed: ${err instanceof Error ? err.message : "unknown"}`,
        );
      }
    } else {
      setDraftSaveMsg("Draft saved to session (connect wallet for encrypted save)");
    }

    setDraftSaved(true);
    setTimeout(() => {
      setDraftSaved(false);
      setDraftSaveMsg(null);
    }, 3000);
  }, [rows, epochId, viewKey, address, activeDraftId]);

  // Load an encrypted draft from IndexedDB
  const loadEncryptedDraft = useCallback(
    async (envelope: DraftEnvelope) => {
      if (!viewKey) return;
      try {
        const keyProvider = new SessionKeyProvider(viewKey);
        const payload = await decryptDraft(envelope, keyProvider);
        // Re-resolve workers from the store after loading draft
        const resolvedRows = payload.rows.map((row: PayrollTableRow) => {
          if (row.worker_name && !row.resolved) {
            const match = resolveWorker(row.worker_name, workers, [], row.id);
            if (match) return applyWorkerToRow(row, match);
          }
          return row;
        });
        setRows(resolvedRows);
        setEpochId(payload.epochId);
        setActiveDraftId(envelope.draftId);
        // Also save to sessionStorage for same-tab consistency
        sessionStorage.setItem(
          DRAFT_STORAGE_KEY,
          JSON.stringify({ rows: resolvedRows, epochId: payload.epochId }),
        );
      } catch (err) {
        setCompileError(
          `Failed to decrypt draft: ${err instanceof Error ? err.message : "unknown"}. Wrong view key?`,
        );
      }
    },
    [viewKey, workers],
  );

  // Delete an encrypted draft
  const removeEncryptedDraft = useCallback(
    async (draftId: string) => {
      await deleteDraft(draftId);
      if (address) {
        const drafts = await listDrafts(address);
        setSavedDrafts(drafts);
      }
      if (activeDraftId === draftId) setActiveDraftId(null);
    },
    [address, activeDraftId],
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">
            New Payroll Run
          </h1>
          <p className="text-sm text-muted-foreground">
            Select workers by .pnw name and enter gross pay
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
          {draftSaveMsg ?? "Draft saved."}
        </p>
      )}

      {/* Saved encrypted drafts list */}
      {savedDrafts.length > 0 && !compiledManifest && (
        <div className="rounded-md border border-border p-3">
          <p className="mb-2 text-sm font-medium text-foreground">
            Saved Drafts (encrypted)
          </p>
          <div className="space-y-1">
            {savedDrafts.map((d) => (
              <div
                key={d.draftId}
                className={`flex items-center justify-between rounded px-2 py-1 text-xs ${
                  d.draftId === activeDraftId
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted"
                }`}
              >
                <span>
                  Epoch {d.epochId} · {d.rowCount} row
                  {d.rowCount !== 1 ? "s" : ""} ·{" "}
                  {new Date(d.savedAt).toLocaleDateString()}
                </span>
                <span className="flex gap-2">
                  <button
                    className="underline hover:text-foreground"
                    onClick={() => loadEncryptedDraft(d)}
                  >
                    Load
                  </button>
                  <button
                    className="underline text-red-500 hover:text-red-700"
                    onClick={() => removeEncryptedDraft(d.draftId)}
                  >
                    Delete
                  </button>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Table */}
      <PayrollTable
        rows={rows}
        onUpdateRow={updateRow}
        onRemoveRow={removeRow}
        onSelectWorker={selectWorker}
        validationResults={rowResults}
        workers={workers}
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
          disabled={isSettling}
          onCancel={() => {
            setCompiledManifest(null);
            setCompiledChunks([]);
          }}
          onConfirm={() => {
            if (settlingRef.current) return;
            settlingRef.current = true;
            setIsSettling(true);
            setSettlementStatus("Queuing settlement...");

            // Store manifest in payroll run store
            setManifest(compiledManifest);
            updateChunks(compiledChunks);

            // Get private key for adapter
            const privateKey = getPrivateKey();
            if (!privateKey) {
              setCompileError("No private key in session. Please reconnect.");
              setIsSettling(false);
              settlingRef.current = false;
              return;
            }

            const callbacks: CoordinatorCallbacks = {
              onRunStatusChange: (status: PayrollRunStatus) => {
                updateStatus(status);
                setSettlementStatus(`Status: ${status}`);
              },
              onChunkUpdate: (chunks: ChunkPlan[]) => {
                updateChunks(chunks);
                const settled = chunks.filter((c) => c.status === "settled").length;
                setSettlementStatus(`Settling: ${settled}/${chunks.length} chunks`);
              },
              onRowUpdate: () => {
                // Row updates handled via chunk updates
              },
              onComplete: () => {
                setSettlementStatus("Settlement complete!");
                setIsSettling(false);
                settlingRef.current = false;
                // Navigate to run status page after short delay
                setTimeout(() => router.push(`/payroll/${compiledManifest.batch_id}`), 1500);
              },
              onError: (msg: string) => {
                setSettlementStatus(`Error: ${msg}`);
                setIsSettling(false);
                settlingRef.current = false;
              },
            };

            // Fire and forget — the coordinator handles its own lifecycle
            void executeSettlement({
              manifest: compiledManifest,
              chunks: compiledChunks,
              adapterConfig: {
                endpoint: ENV.ALEO_ENDPOINT,
                network: ENV.NETWORK,
                privateKey,
              },
              callbacks,
            });
          }}
        />
      )}

      {/* Settlement status */}
      {settlementStatus && (
        <div className={`rounded-md border p-3 text-sm ${
          isSettling
            ? "border-blue-300 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-200"
            : settlementStatus.startsWith("Error")
              ? "border-red-300 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200"
              : "border-green-300 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-200"
        }`}>
          <p>{isSettling ? "... " : ""}{settlementStatus}</p>
        </div>
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
