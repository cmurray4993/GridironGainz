import { useMemo, type ReactNode } from "react";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
import { SolflareWalletAdapter } from "@solana/wallet-adapter-solflare";
import { clusterApiUrl, type Cluster } from "@solana/web3.js";

export function SolanaWalletProvider({ children }: { children: ReactNode }) {
  const network = ((import.meta.env.VITE_SOLANA_NETWORK as Cluster) || "mainnet-beta") as Cluster;
  const endpoint = useMemo(
    () => (import.meta.env.VITE_SOLANA_RPC as string) || clusterApiUrl(network),
    [network],
  );
  const wallets = useMemo(
    () => [new PhantomWalletAdapter(), new SolflareWalletAdapter()],
    [],
  );

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        {children}
      </WalletProvider>
    </ConnectionProvider>
  );
}

export const TREASURY_WALLET = (import.meta.env.VITE_TREASURY_WALLET as string) || "";
