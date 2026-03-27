"use client";

import { useState, useCallback } from "react";
import { useWallet } from "@provablehq/aleo-wallet-adaptor-react";
import {
  executeAleoTransaction,
  pollTransactionStatus,
  type TransactionResult,
  type TransactionStatus,
  type WalletExecuteFn,
  TransientError,
  PermanentError,
} from "./wallet-executor";

type WalletTransactionStatusFn = (txId: string) => Promise<{
  status: string;
  transactionId?: string;
  error?: string;
}>;

// ----------------------------------------------------------------
// Hook return type
// ----------------------------------------------------------------

export type TransactionExecutor = {
  /** Execute a transaction via the connected wallet */
  execute: (
    programId: string,
    functionName: string,
    inputs: string[],
    fee?: number,
  ) => Promise<TransactionResult>;

  /** Current transaction status */
  status: TransactionStatus | "idle" | "submitting";

  /** Whether a transaction is in flight */
  isExecuting: boolean;

  /** Last completed transaction result */
  lastResult: TransactionResult | null;

  /** Error message if the last transaction failed */
  error: string | null;

  /** Reset state for a new transaction */
  reset: () => void;
};

// ----------------------------------------------------------------
// Wallet-native transaction status polling
// ----------------------------------------------------------------

const WALLET_POLL_INTERVAL_MS = 5_000;
const WALLET_POLL_TIMEOUT_MS = 300_000; // 5 minutes

async function pollViaWallet(
  txId: string,
  walletStatus: WalletTransactionStatusFn,
  onStatusChange?: (status: TransactionStatus) => void,
): Promise<TransactionResult> {
  const startTime = Date.now();
  onStatusChange?.("pending");

  while (Date.now() - startTime < WALLET_POLL_TIMEOUT_MS) {
    await new Promise((r) => setTimeout(r, WALLET_POLL_INTERVAL_MS));

    try {
      const result = await walletStatus(txId);
      console.log("[PNW-TX] Wallet transactionStatus response:", result);

      const s = result.status?.toLowerCase();

      if (s === "finalized" || s === "confirmed" || s === "accepted" || s === "completed") {
        onStatusChange?.("confirmed");
        return {
          txId: result.transactionId ?? txId,
          status: "confirmed",
        };
      }

      if (s === "rejected" || s === "failed") {
        onStatusChange?.("rejected");
        return {
          txId: result.transactionId ?? txId,
          status: "rejected",
          error: result.error ?? "Transaction rejected by network",
        };
      }

      // Still pending/proving — keep polling
    } catch (err) {
      console.warn("[PNW-TX] Wallet poll error:", err instanceof Error ? err.message : err);
    }
  }

  onStatusChange?.("unknown");
  return {
    txId,
    status: "unknown",
    error: "Transaction status check timed out after 5 minutes",
  };
}

/**
 * React hook wrapping wallet-executor for UI components.
 *
 * Usage:
 *   const { execute, status, isExecuting, error } = useTransactionExecutor();
 *   const result = await execute("program.aleo", "function_name", inputs);
 */
export function useTransactionExecutor(): TransactionExecutor {
  const { executeTransaction, transactionStatus: walletTransactionStatus } = useWallet();

  const [status, setStatus] = useState<TransactionStatus | "idle" | "submitting">("idle");
  const [isExecuting, setIsExecuting] = useState(false);
  const [lastResult, setLastResult] = useState<TransactionResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const execute = useCallback(
    async (
      programId: string,
      functionName: string,
      inputs: string[],
      fee: number = 500_000,
    ): Promise<TransactionResult> => {
      setIsExecuting(true);
      setError(null);
      setStatus("submitting");
      setLastResult(null);

      try {
        // Wrap the wallet adapter's executeTransaction as our WalletExecuteFn
        const walletExecute: WalletExecuteFn = async (params) => {
          if (!executeTransaction) {
            throw new PermanentError("Wallet not connected or does not support execution");
          }
          console.log("[PNW-TX] Sending to wallet:", {
            program: params.program,
            function: params.function,
            inputs: params.inputs,
            fee: params.fee,
          });
          const result = await executeTransaction({
            program: params.program,
            function: params.function,
            inputs: params.inputs,
            fee: params.fee,
            privateFee: false,
          });
          console.log("[PNW-TX] Wallet returned:", result);
          if (!result) throw new PermanentError("Wallet returned no result");
          return result.transactionId;
        };

        // Submit transaction
        console.log("[PNW-TX] Executing:", { programId, functionName, inputs, fee });
        const txId = await executeAleoTransaction(
          walletExecute,
          programId,
          functionName,
          inputs,
          fee,
        );
        console.log("[PNW-TX] Got txId:", txId);

        // Use wallet's transactionStatus if available (handles wallet-specific IDs like shield_...)
        // Falls back to REST API polling for standard at1... IDs
        const isWalletSpecificId = !txId.startsWith("at1");
        let txResult: TransactionResult;

        if (isWalletSpecificId && walletTransactionStatus) {
          console.log("[PNW-TX] Using wallet transactionStatus polling (wallet-specific ID)");
          txResult = await pollViaWallet(
            txId,
            walletTransactionStatus as WalletTransactionStatusFn,
            (s) => { console.log("[PNW-TX] Wallet poll status:", s); setStatus(s); },
          );
        } else {
          console.log("[PNW-TX] Using REST API polling (standard tx ID)");
          txResult = await pollTransactionStatus(txId, (s) => {
            console.log("[PNW-TX] Poll status:", s);
            setStatus(s);
          });
        }

        setLastResult(txResult);
        setStatus(txResult.status);

        if (txResult.status === "rejected") {
          setError(txResult.error ?? "Transaction rejected");
        } else if (txResult.status === "unknown") {
          setError(txResult.error ?? "Transaction status could not be confirmed. Check your wallet or try again.");
        }

        return txResult;
      } catch (err) {
        console.error("[PNW-TX] Transaction failed:", err);
        const message = err instanceof Error ? err.message : String(err);
        setError(message);

        const result: TransactionResult = {
          txId: "",
          status: "rejected",
          error: message,
        };

        if (err instanceof TransientError) {
          result.error = `Network error: ${message}. Please try again.`;
        } else if (err instanceof PermanentError) {
          result.error = message;
        }

        setLastResult(result);
        setStatus("rejected");
        return result;
      } finally {
        setIsExecuting(false);
      }
    },
    [executeTransaction],
  );

  const reset = useCallback(() => {
    setStatus("idle");
    setIsExecuting(false);
    setLastResult(null);
    setError(null);
  }, []);

  return {
    execute,
    status,
    isExecuting,
    lastResult,
    error,
    reset,
  };
}
