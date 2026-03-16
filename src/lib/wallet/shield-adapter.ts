/**
 * Shield Wallet Adapter — re-exports the official first-party adapter
 * from @provablehq/aleo-wallet-adaptor-shield.
 *
 * Shield is a separate wallet from Leo, built by Provable. It injects
 * as window.shield and has its own connect API that takes Network enum
 * directly (not LEO_NETWORK_MAP's "testnetbeta" mapping).
 */
export { ShieldWalletAdapter } from "@provablehq/aleo-wallet-adaptor-shield";
