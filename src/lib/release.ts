import type { Cluster } from "@solana/web3.js";

const SUPPORTED_NETWORKS: Cluster[] = ["devnet", "testnet", "mainnet-beta"];
const requestedNetwork = import.meta.env.VITE_SOLANA_NETWORK as string | undefined;

export const REQUESTED_SOLANA_NETWORK: Cluster = SUPPORTED_NETWORKS.includes(
  requestedNetwork as Cluster,
)
  ? (requestedNetwork as Cluster)
  : "devnet";

/**
 * Mainnet commerce is intentionally fail-closed. These flags are separate so a
 * single accidental environment-variable change cannot enable real payments.
 * The server applies the same independent gate.
 */
export const MAINNET_REVIEW_COMPLETE =
  import.meta.env.VITE_ENABLE_MAINNET_COMMERCE === "true" &&
  import.meta.env.VITE_LEGAL_REVIEW_COMPLETE === "true" &&
  import.meta.env.VITE_TAX_REVIEW_COMPLETE === "true" &&
  import.meta.env.VITE_SECURITY_REVIEW_COMPLETE === "true";

export const MAINNET_BLOCKED =
  REQUESTED_SOLANA_NETWORK === "mainnet-beta" && !MAINNET_REVIEW_COMPLETE;

// A misconfigured or partially approved production build is forced back to
// devnet instead of merely hiding a warning while retaining real-money rails.
export const SOLANA_NETWORK: Cluster = MAINNET_BLOCKED ? "devnet" : REQUESTED_SOLANA_NETWORK;

export const IS_TEST_NETWORK = SOLANA_NETWORK !== "mainnet-beta";
export const TESTNET_DISCLOSURE =
  "Devnet beta only. Devnet SOL, Gridiron Cash, Coins, cards, and rewards have no cash value.";

export function requirePurchaseNetwork() {
  if (SOLANA_NETWORK === "mainnet-beta" && !MAINNET_REVIEW_COMPLETE) {
    throw new Error(
      "Real-money purchases are disabled until legal, tax, and security review is complete.",
    );
  }
}
