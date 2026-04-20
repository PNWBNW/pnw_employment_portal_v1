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
import { useOfferStore } from "@/src/stores/offer_store";
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
  type WorkerProgress,
} from "@/src/coordinator/settlement_coordinator";
import { getPrivateKey } from "@/src/stores/session_store";
import { ENV } from "@/src/config/env";
import {
  computePayrollTax,
  type FilingStatus,
  type PayPeriod,
} from "@/src/lib/tax-engine";
import { useWallet } from "@provablehq/aleo-wallet-adaptor-react";
import { scanAgreementRecords, readAgreementRecords } from "@/src/records/agreement_reader";
import type { WalletExecuteFn } from "@/src/lib/wallet/wallet-executor";
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

/**
 * Get a unique epoch_id for this payroll run.
 *
 * Uses unix timestamp in seconds (fits in u32 until year 2106). This guarantees
 * uniqueness for the on-chain `paid_epoch[(agreement_id, epoch_id)]` double-pay
 * guard, so the same worker can be paid multiple times on the same day for
 * legitimate reasons (regular pay + bonus + reimbursement) — each run gets its
 * own epoch_id.
 *
 * Display the human-readable date alongside via `formatEpochAsDate(epochId)`.
 */
function todayEpoch(): string {
  return Math.floor(Date.now() / 1000).toString();
}

/** Convert a unix-seconds epoch_id back to a human-readable timestamp */
function formatEpochAsDate(epochId: string | number): string {
  const seconds = typeof epochId === "string" ? parseInt(epochId, 10) : epochId;
  if (!seconds || isNaN(seconds)) return "—";
  // Sanity: if value looks like YYYYMMDD (8 digits, < 99999999), treat as legacy
  if (seconds >= 19700101 && seconds <= 99999999) {
    const y = Math.floor(seconds / 10000);
    const m = Math.floor((seconds % 10000) / 100);
    const d = seconds % 100;
    return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")} (legacy)`;
  }
  return new Date(seconds * 1000).toLocaleString();
}

export default function NewPayrollPage() {
  const [rows, setRows] = useState<PayrollTableRow[]>([]);
  const [epochId, setEpochId] = useState(todayEpoch);
  const [filingStatus, setFilingStatus] = useState<FilingStatus>("single");

  // Map PNW pay frequency codes to tax engine pay period types.
  // Used to determine how many periods per year for annualization.
  const PAY_FREQ_TO_PERIOD: Record<number, PayPeriod> = {
    1: "daily",
    2: "weekly",
    3: "biweekly",
    4: "monthly",
    5: "quarterly",
  };
  const [draftSaved, setDraftSaved] = useState(false);
  const [draftSaveMsg, setDraftSaveMsg] = useState<string | null>(null);
  const [savedDrafts, setSavedDrafts] = useState<DraftEnvelope[]>([]);
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);
  const [compiledManifest, setCompiledManifest] = useState<PayrollRunManifest | null>(null);
  const [compiledChunks, setCompiledChunks] = useState<ChunkPlan[]>([]);
  const [compileError, setCompileError] = useState<string | null>(null);
  const [isSettling, setIsSettling] = useState(false);
  const [settlementStatus, setSettlementStatus] = useState<string | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingSettleAction, setPendingSettleAction] = useState<(() => void) | null>(null);
  const [currentPayrollStep, setCurrentPayrollStep] = useState<{
    stepNumber: number;
    totalSteps: number;
    label: string;
    workerContext?: string;
    overallStepNumber?: number;
    overallTotalSteps?: number;
  } | null>(null);
  // Live per-worker progress for the monolithic execute_payroll path
  const [workerProgress, setWorkerProgress] = useState<WorkerProgress | null>(null);
  const [progressLog, setProgressLog] = useState<string[]>([]);
  // Ticking timestamp so the elapsed-time display updates every second
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  // Tick nowMs every second only while a worker is mid-pipeline
  useEffect(() => {
    if (
      !workerProgress ||
      workerProgress.stage === "confirmed" ||
      workerProgress.stage === "failed"
    ) {
      return;
    }
    const interval = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [workerProgress?.stage]);
  const workers = useWorkerStore((s) => s.workers);
  const setWorkers = useWorkerStore((s) => s.setWorkers);
  const address = useSessionStore((s) => s.address);
  const viewKey = useSessionStore((s) => s.viewKey);
  const { requestRecords, executeTransaction, transactionStatus: walletTransactionStatus } = useWallet();
  const setManifest = usePayrollRunStore((s) => s.setManifest);
  const updateChunks = usePayrollRunStore((s) => s.updateChunks);
  const updateStoreRow = usePayrollRunStore((s) => s.updateRow);
  const updateStatus = usePayrollRunStore((s) => s.updateStatus);
  const router = useRouter();
  const settlingRef = useRef(false);
  const workersLoadedRef = useRef(false);

  const sentOffers = useOfferStore((s) => s.sentOffers);

  // Load workers from on-chain agreement records (once per mount)
  // Then enrich with pay_type + pay_rate from the offer store
  useEffect(() => {
    if (workersLoadedRef.current || workers.length > 0 || !address) return;
    workersLoadedRef.current = true;
    (async () => {
      let records = requestRecords
        ? await scanAgreementRecords(requestRecords, address)
        : [];
      if (records.length === 0 && viewKey) {
        records = await readAgreementRecords(viewKey, address);
      }
      if (records.length > 0) {
        // Enrich with pay info from the offer store — the offer's
        // pay_type and pay_rate are stored in the encrypted terms
        // (not on-chain), so we pull them from the local offer tracking.
        const enriched = records.map((r) => {
          // Try to recover pay info from two sources:
          // 1. The offer store (sessionStorage — available if the offer was
          //    created in this browser session)
          // 2. A durable localStorage cache keyed by agreement_id (survives
          //    tab close / browser restart)
          const matchingOffer = sentOffers.find(
            (o) => o.computed.agreement_id === r.agreement_id,
          );
          if (matchingOffer?.offer.pay_type && matchingOffer?.offer.pay_rate) {
            // Cache durably so it survives session loss
            try {
              localStorage.setItem(
                `pnw_pay_${r.agreement_id}`,
                JSON.stringify({ pay_type: matchingOffer.offer.pay_type, pay_rate: matchingOffer.offer.pay_rate }),
              );
            } catch { /* storage full — non-critical */ }
            return {
              ...r,
              pay_type: matchingOffer.offer.pay_type as "hourly" | "salary",
              pay_rate: matchingOffer.offer.pay_rate,
            };
          }
          // Fallback: check durable cache
          try {
            const cached = localStorage.getItem(`pnw_pay_${r.agreement_id}`);
            if (cached) {
              const { pay_type, pay_rate } = JSON.parse(cached);
              if (pay_type && pay_rate) {
                return { ...r, pay_type, pay_rate };
              }
            }
          } catch { /* parse error — skip */ }
          return r;
        });
        setWorkers(enriched);
      }
    })().catch(() => {});
  }, [viewKey, address, requestRecords, workers.length, setWorkers, sentOffers]);

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

        // Auto-calculate gross from hours × rate for hourly workers
        if (field === "hours_worked" && newRow.pay_type === "hourly" && newRow.pay_rate) {
          const hours = parseFloat(value);
          if (!isNaN(hours) && hours >= 0) {
            newRow.gross_amount = formatDollar(hours * newRow.pay_rate);
          }
        }

        // Auto-compute tax when gross changes (or hours change for hourly)
        // Uses the tax engine's annualization method to determine the
        // correct marginal bracket based on projected annual income.
        if (
          field === "gross_amount" ||
          field === "hours_worked" ||
          field === "fee_amount"
        ) {
          const gross = parseDollar(
            field === "gross_amount" ? value : newRow.gross_amount,
          );

          if (!isNaN(gross) && gross > 0) {
            // Determine pay period from the worker's pay frequency
            // (stored on the worker record from the agreement). Default
            // to biweekly if unknown.
            const workerMatch = workers.find(
              (w) => w.agreement_id === newRow.agreement_id,
            );
            // Pay frequency isn't on WorkerRecord yet — default to biweekly
            const payPeriod: PayPeriod = "biweekly";

            // Compute YTD gross from other rows in this table (rough
            // approximation — real YTD would come from on-chain receipts)
            const ytdFromOtherRows = rows
              .filter((r, i) => i !== index && r.resolved)
              .reduce((sum, r) => {
                const g = parseDollar(r.gross_amount);
                return sum + (isNaN(g) ? 0 : g);
              }, 0);

            const taxResult = computePayrollTax({
              gross,
              filingStatus,
              payPeriod,
              ytdGross: ytdFromOtherRows,
            });

            // Auto-fill the tax column from the engine
            newRow.tax_withheld = formatDollar(taxResult.totalTax);
          }

          // Recompute net = gross - tax - fee
          const grossFinal = parseDollar(newRow.gross_amount);
          const taxFinal = parseDollar(newRow.tax_withheld);
          const fee = parseDollar(
            field === "fee_amount" ? value : newRow.fee_amount,
          );
          if (!isNaN(grossFinal) && !isNaN(taxFinal) && !isNaN(fee)) {
            newRow.net_amount = formatDollar(grossFinal - taxFinal - fee);
          }
        }

        // Manual tax override — if the employer explicitly edits the
        // tax field, just recompute net without re-running the engine
        if (field === "tax_withheld") {
          const gross = parseDollar(newRow.gross_amount);
          const tax = parseDollar(value);
          const fee = parseDollar(newRow.fee_amount);
          if (!isNaN(gross) && !isNaN(tax) && !isNaN(fee)) {
            newRow.net_amount = formatDollar(gross - tax - fee);
          }
        }

        updated[index] = newRow;
        return updated;
      });
      setDraftSaved(false);
    },
    [workers, filingStatus, rows],
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

  // Extracted settlement launcher — called by the confirmation dialog
  const startSettlement = useCallback(() => {
    if (!compiledManifest) return;
    if (settlingRef.current) return;
    settlingRef.current = true;
    setIsSettling(true);
    setSettlementStatus("Queuing settlement...");
    setCurrentPayrollStep(null);

    setManifest(compiledManifest);
    updateChunks(compiledChunks);

    let walletExecute: WalletExecuteFn | undefined;
    let privateKey: string | null = null;

    if (executeTransaction) {
      walletExecute = async (params) => {
        console.log("[PNW-PAYROLL] Calling wallet executeTransaction...", {
          program: params.program,
          function: params.function,
          inputCount: params.inputs.length,
          fee: params.fee,
        });
        try {
          // CRITICAL: privateFee: false is required — Shield wallet silently
          // fails proof generation without it (tries to use a private credits
          // record for the fee and can't resolve it). This matches how
          // useTransactionExecutor calls it for create_job_offer etc.
          const result = await executeTransaction({
            program: params.program,
            function: params.function,
            inputs: params.inputs,
            fee: params.fee,
            privateFee: false,
          });
          console.log("[PNW-PAYROLL] Wallet returned:", result);
          const txId = typeof result === "string"
            ? result
            : (result as Record<string, unknown>)?.transactionId as string
              ?? (result as Record<string, unknown>)?.id as string
              ?? String(result);
          return txId;
        } catch (err) {
          console.error("[PNW-PAYROLL] Wallet executeTransaction FAILED:", err);
          throw err;
        }
      };
    } else {
      privateKey = getPrivateKey();
      if (!privateKey) {
        setCompileError("No wallet connected and no private key in session. Please connect your wallet.");
        setSettlementStatus(null);
        setIsSettling(false);
        settlingRef.current = false;
        return;
      }
    }

    const callbacks: CoordinatorCallbacks = {
      onRunStatusChange: (status: PayrollRunStatus) => {
        updateStatus(status);
        setSettlementStatus(`Status: ${status}`);
      },
      onChunkUpdate: (chunks: ChunkPlan[]) => {
        updateChunks(chunks);
      },
      onRowUpdate: (rowIndex, status, txId) => {
        updateStoreRow(rowIndex, status, txId);
      },
      onComplete: () => {
        setSettlementStatus("Settlement complete!");
        setCurrentPayrollStep(null);
        setIsSettling(false);
        settlingRef.current = false;
        // Mark ALL rows as settled (sequential path doesn't emit per-row updates yet)
        compiledManifest.rows.forEach((row) => {
          updateStoreRow(row.row_index, "settled" as const);
        });
        updateStatus("settled" as const);
        // Clear progress bar after a short delay so the user sees the final state
        setTimeout(() => {
          setWorkerProgress(null);
          setProgressLog([]);
        }, 2000);
        setTimeout(() => router.push(`/payroll/${compiledManifest.batch_id}`), 1500);
      },
      onError: (msg: string) => {
        setSettlementStatus(`Error: ${msg}`);
        setCurrentPayrollStep(null);
        setIsSettling(false);
        settlingRef.current = false;
        // Leave workerProgress visible so the user can see which worker/stage failed
      },
    };

    executeSettlement({
      manifest: compiledManifest,
      chunks: compiledChunks,
      adapterConfig: {
        endpoint: ENV.ALEO_ENDPOINT,
        network: ENV.NETWORK,
        privateKey: privateKey ?? "",
      },
      callbacks,
      walletExecute,
      walletTransactionStatus: walletTransactionStatus ?? undefined,
      requestRecords: requestRecords ?? undefined,
      viewKey: viewKey ?? undefined,
      skipCredentials: true,
      onStepChange: (step) => {
        console.log(`[PNW-PAYROLL] Step change: ${step.stepNumber}/${step.totalSteps} — ${step.label}`);
        setCurrentPayrollStep(step);
        setSettlementStatus(`Step ${step.stepNumber}/${step.totalSteps}: ${step.label}`);
      },
      onWorkerProgress: (progress) => {
        setWorkerProgress(progress);
        setNowMs(Date.now()); // Force a tick so the elapsed display refreshes immediately
        setProgressLog((prev) => {
          // Append the new stage message + any extra log line, dedup consecutive duplicates
          const additions: string[] = [];
          const stageLine = `[${progress.stage}] ${progress.stageMessage}`;
          if (prev[prev.length - 1] !== stageLine) additions.push(stageLine);
          if (progress.lastLogLine && prev[prev.length - 1] !== progress.lastLogLine) {
            additions.push(progress.lastLogLine);
          }
          // Keep only the most recent 12 lines to avoid runaway growth
          return [...prev, ...additions].slice(-12);
        });
        // When a new worker starts, clear the previous worker's log
        if (progress.stage === "preparing") {
          setProgressLog([`[preparing] ${progress.stageMessage}`]);
        }
      },
    }).then((result) => {
      console.log("[PNW-PAYROLL] Settlement finished:", result);
    }).catch((err) => {
      console.error("[PNW-PAYROLL] Settlement UNHANDLED ERROR:", err);
      setSettlementStatus(`Error: ${err instanceof Error ? err.message : String(err)}`);
      setCurrentPayrollStep(null);
      setIsSettling(false);
      settlingRef.current = false;
    });
  }, [
    compiledManifest,
    compiledChunks,
    executeTransaction,
    walletTransactionStatus,
    requestRecords,
    viewKey,
    setManifest,
    updateChunks,
    updateStoreRow,
    updateStatus,
    router,
  ]);

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
        filingStatus={filingStatus}
        onFilingStatusChange={setFilingStatus}
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
            // Show warning dialog first — payroll requires 4 wallet signatures
            setPendingSettleAction(() => () => startSettlement());
            setShowConfirmDialog(true);
          }}
        />
      )}

      {/* Confirmation dialog: monolithic execute_payroll path (1 sig per worker) */}
      {showConfirmDialog && (() => {
        const rowCount = compiledManifest?.row_count ?? 1;
        // Each worker = 1 monolithic execute_payroll signature.
        const sigCount = rowCount;
        const sigWord = sigCount === 1 ? "Signature" : "Signatures";
        return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="max-w-md rounded-lg border border-border bg-card p-6 shadow-xl">
            <h2 className="mb-3 text-lg font-semibold text-foreground">
              Payroll Requires {sigCount} Wallet {sigWord}
            </h2>
            <p className="mb-4 text-sm text-muted-foreground">
              {rowCount === 1 ? (
                <>This payroll for 1 worker will be settled in a single on-chain transaction.</>
              ) : (
                <>
                  Each worker is settled in its own on-chain transaction
                  ({rowCount} workers = {sigCount} signatures). You will be prompted
                  to sign each one in order.
                </>
              )}
            </p>
            <p className="mb-4 text-sm text-muted-foreground">
              Each signature triggers an on-chain transaction that does the following atomically:
            </p>
            <ol className="mb-4 space-y-2 text-sm">
              <li className="flex gap-2">
                <span className="font-mono text-xs text-muted-foreground">1.</span>
                <span><strong className="text-foreground">Verify Agreement(s)</strong> — confirms the agreement is active on-chain</span>
              </li>
              <li className="flex gap-2">
                <span className="font-mono text-xs text-muted-foreground">2.</span>
                <span><strong className="text-foreground">Transfer USDCx privately</strong> — net amount sent via Sealance-compliant private transfer</span>
              </li>
              <li className="flex gap-2">
                <span className="font-mono text-xs text-muted-foreground">3.</span>
                <span><strong className="text-foreground">Mint Paystub Receipts</strong> — private records for worker and employer</span>
              </li>
              <li className="flex gap-2">
                <span className="font-mono text-xs text-muted-foreground">4.</span>
                <span><strong className="text-foreground">Anchor Audit Event</strong> — public tamper-proof timestamp</span>
              </li>
            </ol>
            <div className="mb-4 rounded-md border border-amber-500/30 bg-amber-500/5 p-3">
              <p className="text-xs text-amber-700 dark:text-amber-300">
                ⚠ Each signature may take 2–5 minutes to generate its zero-knowledge proof. <strong>Do not close this page until all {sigCount} signature{sigCount === 1 ? "" : "s"} complete.</strong>
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowConfirmDialog(false);
                  setPendingSettleAction(null);
                }}
                className="rounded-md border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowConfirmDialog(false);
                  if (pendingSettleAction) pendingSettleAction();
                  setPendingSettleAction(null);
                }}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                I Understand — Begin Signing
              </button>
            </div>
          </div>
        </div>
        );
      })()}

      {/* Current payroll step indicator */}
      {currentPayrollStep && isSettling && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
          {/* Worker context (multi-worker only) */}
          {currentPayrollStep.workerContext && (
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-primary">
              {currentPayrollStep.workerContext}
            </p>
          )}

          {/* Per-worker step counter + dots */}
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-primary">
              Step {currentPayrollStep.stepNumber} of {currentPayrollStep.totalSteps}
            </span>
            <div className="flex gap-1">
              {Array.from({ length: currentPayrollStep.totalSteps }).map((_, i) => (
                <div
                  key={i}
                  className={`h-2 w-8 rounded-full ${
                    i < currentPayrollStep.stepNumber
                      ? "bg-primary"
                      : "bg-muted"
                  }`}
                />
              ))}
            </div>
          </div>

          <p className="text-sm font-semibold text-foreground">{currentPayrollStep.label}</p>

          {/* Overall progress bar (multi-worker only) */}
          {currentPayrollStep.overallTotalSteps && currentPayrollStep.overallTotalSteps > currentPayrollStep.totalSteps && (
            <div className="mt-3">
              <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                <span>Overall progress</span>
                <span>{currentPayrollStep.overallStepNumber} of {currentPayrollStep.overallTotalSteps}</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-primary transition-all"
                  style={{
                    width: `${((currentPayrollStep.overallStepNumber ?? 0) / currentPayrollStep.overallTotalSteps) * 100}%`,
                  }}
                />
              </div>
            </div>
          )}

          <p className="mt-3 text-xs text-muted-foreground">
            Building zero-knowledge proof in your wallet... This can take 2–5 minutes per signature. Do not close this page.
          </p>
        </div>
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

                  // FORCED single-row chunks (1 sig per worker).
                  //
                  // execute_payroll_batch_2 fails at the AVM level because it
                  // tries to consume the chained 'remainder' Token from the
                  // first transfer as input to the second transfer in the
                  // SAME transition — Aleo doesn't allow consuming records
                  // that were created in the same transition. Error:
                  // "Input record for 'test_usdcx_stablecoin.aleo' must
                  //  belong to the signer"
                  //
                  // Until we redesign execute_payroll_batch_2 to take 2
                  // independent Token records, force chunkSize=1 so each
                  // worker uses the working single-worker execute_payroll.
                  // Multi-worker payroll = N signatures, but each settles
                  // correctly with the recipient fix in place.
                  const chunks = planChunks(manifest, 1);
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

      {/* Sticky per-worker progress bar (bottom of page) */}
      {workerProgress && (() => {
        const elapsedMs = Math.max(0, nowMs - workerProgress.startedAt);
        const estTotal = workerProgress.estimatedTotalMs || 170_000;
        // 0→90% fills linearly over the estimated duration. If the run finishes
        // early the bar jumps to 100%. If it runs long the bar pauses at ~90%
        // until the on-chain confirmation lands. Resets to 0 when the coordinator
        // emits "preparing" for a new worker (startedAt changes → elapsedMs=0).
        const isDone = workerProgress.stage === "confirmed";
        const isFailed = workerProgress.stage === "failed";
        const linearPct = Math.min((elapsedMs / estTotal) * 90, 90);
        const pct = isDone ? 100 : isFailed ? linearPct : linearPct;
        const elapsedSec = Math.floor(elapsedMs / 1000);
        const estSec = Math.floor(estTotal / 1000);
        const remainingSec = Math.max(0, estSec - elapsedSec);
        const fmt = (s: number) => {
          const m = Math.floor(s / 60);
          const r = s % 60;
          return m > 0 ? `${m}m ${r}s` : `${r}s`;
        };
        const barColor = isFailed
          ? "bg-red-500"
          : isDone
            ? "bg-green-500"
            : "bg-primary";
        return (
          <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur-sm shadow-lg">
            <div className="mx-auto max-w-5xl px-4 py-3">
              <div className="mb-2 flex items-center justify-between gap-4">
                <div className="flex items-baseline gap-3 min-w-0">
                  <span className="text-xs font-medium uppercase tracking-wider text-primary">
                    Worker {workerProgress.workerNumber} of {workerProgress.totalWorkers}
                  </span>
                  <span className="truncate font-mono text-xs text-muted-foreground">
                    {workerProgress.workerLabel}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {isDone
                    ? `Done in ${fmt(elapsedSec)}`
                    : isFailed
                      ? `Failed after ${fmt(elapsedSec)}`
                      : `${fmt(elapsedSec)} elapsed · ~${fmt(remainingSec)} remaining`}
                </span>
              </div>

              <div className="mb-2 h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className={`h-full ${barColor} transition-all duration-500 ease-out`}
                  style={{ width: `${pct}%` }}
                />
              </div>

              <div className="mb-2 flex items-center gap-2">
                <span className={`inline-block h-2 w-2 rounded-full ${
                  isFailed ? "bg-red-500" : isDone ? "bg-green-500" : "animate-pulse bg-primary"
                }`} />
                <span className="text-sm font-medium text-foreground">
                  {workerProgress.stage === "preparing" && "Preparing"}
                  {workerProgress.stage === "awaiting_signature" && "Awaiting wallet signature"}
                  {workerProgress.stage === "proving" && "Generating zero-knowledge proof"}
                  {workerProgress.stage === "broadcasting" && "Broadcasting to network"}
                  {workerProgress.stage === "confirming" && "Confirming on-chain"}
                  {workerProgress.stage === "confirmed" && "Confirmed"}
                  {workerProgress.stage === "failed" && "Failed"}
                </span>
                <span className="text-sm text-muted-foreground truncate">
                  — {workerProgress.stageMessage}
                </span>
              </div>

              {progressLog.length > 0 && (
                <details className="text-xs">
                  <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                    Activity log ({progressLog.length})
                  </summary>
                  <div className="mt-2 max-h-32 overflow-y-auto rounded border border-border bg-muted/40 p-2 font-mono text-[11px] leading-relaxed text-muted-foreground">
                    {progressLog.map((line, i) => (
                      <div key={i} className="truncate">{line}</div>
                    ))}
                  </div>
                </details>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
