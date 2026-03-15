/**
 * Environment configuration.
 * All public env vars are prefixed with NEXT_PUBLIC_ and safe to use client-side.
 * Private keys are NEVER loaded from env in production — entered via UI only.
 */

export const ENV = {
  /** Aleo REST API endpoint */
  ALEO_ENDPOINT:
    process.env.NEXT_PUBLIC_ALEO_ENDPOINT ??
    "https://api.explorer.provable.com/v1/testnet",

  /** Network identifier */
  NETWORK: (process.env.NEXT_PUBLIC_NETWORK ?? "testnet") as
    | "testnet"
    | "mainnet",
} as const;
