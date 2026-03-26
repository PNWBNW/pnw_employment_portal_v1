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

/**
 * React hook wrapping wallet-executor for UI components.
 *
 * Usage:
 *   const { execute, status, isExecuting, error } = useTransactionExecutor();
 *   const result = await execute("program.aleo", "function_name", inputs);
 */
export function useTransactionExecutor(): TransactionExecutor {
  const { executeTransaction } = useWallet();

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

        // Poll for confirmation
        const txResult = await pollTransactionStatus(txId, (s) => {
          console.log("[PNW-TX] Poll status:", s);
          setStatus(s);
        });

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
