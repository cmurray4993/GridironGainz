import { useEffect, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import {
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import { toast } from "sonner";

import { creditGridironCashPurchase, setWalletAddress, useGame } from "@/lib/game/store";
import { GRIDIRON_CASH_PER_SOL } from "@/lib/game/types";
import { SolanaWalletProvider, TREASURY_WALLET } from "@/lib/solana/WalletProvider";
import { createPurchaseIntent, waitForVerifiedPurchase } from "@/lib/solana/gridironCash";
import { getSolUsd } from "@/lib/solana/price";

const QUICK = [0.05, 0.1, 0.5, 1];

function short(addr: string) {
  return addr.slice(0, 4) + "…" + addr.slice(-4);
}

export default function WalletRuntime() {
  return (
    <SolanaWalletProvider>
      <WalletPanel />
    </SolanaWalletProvider>
  );
}

function WalletPanel() {
  const state = useGame();
  const { connection } = useConnection();
  const {
    wallets,
    wallet,
    publicKey,
    connected,
    connecting,
    select,
    connect,
    disconnect,
    sendTransaction,
  } = useWallet();

  const [balance, setBalance] = useState<number | null>(null);
  const [solUsd, setSolUsd] = useState<number>(0);
  const [amount, setAmount] = useState<string>("0.1");
  const [busy, setBusy] = useState(false);
  const [purchaseStep, setPurchaseStep] = useState<string | null>(null);

  useEffect(() => {
    getSolUsd().then(setSolUsd);
  }, []);

  useEffect(() => {
    if (!publicKey) {
      setBalance(null);
      return;
    }
    setWalletAddress(publicKey.toBase58());
    let cancelled = false;
    connection
      .getBalance(publicKey)
      .then((lam) => {
        if (!cancelled) setBalance(lam / LAMPORTS_PER_SOL);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [publicKey, connection]);

  async function pick(name: string) {
    try {
      select(name as never);
      setTimeout(() => {
        connect().catch((e) => toast.error(e?.message ?? "Connect failed"));
      }, 50);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Connect failed");
    }
  }

  async function deposit() {
    if (!publicKey) return;
    const amt = Number(amount);
    if (!amt || amt <= 0) {
      toast.error("Enter an amount");
      return;
    }
    if (!TREASURY_WALLET) {
      toast.error("Treasury not configured");
      return;
    }
    setBusy(true);
    try {
      setPurchaseStep("Creating secure purchase…");
      const intent = await createPurchaseIntent(amt, publicKey.toBase58());
      if (intent.treasuryWallet !== TREASURY_WALLET) {
        throw new Error("Treasury configuration mismatch. Please refresh and try again.");
      }
      const treasury = new PublicKey(intent.treasuryWallet);
      const memoProgram = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");
      const tx = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: treasury,
          lamports: intent.expectedLamports,
        }),
        new TransactionInstruction({
          keys: [],
          programId: memoProgram,
          data: Buffer.from(new TextEncoder().encode(`gridiron-gainz:${intent.purchaseId}`)),
        }),
      );
      const latest = await connection.getLatestBlockhash("confirmed");
      tx.recentBlockhash = latest.blockhash;
      tx.feePayer = publicKey;
      setPurchaseStep("Approve the transaction in your wallet…");
      const sig = await sendTransaction(tx, connection);
      setPurchaseStep("Waiting for Solana confirmation…");
      toast.loading("Confirming deposit…", { id: sig });
      await connection.confirmTransaction({ signature: sig, ...latest }, "confirmed");
      setPurchaseStep("Verifying payment securely…");
      const verified = await waitForVerifiedPurchase(intent.purchaseId, sig);
      const verifiedSol = verified.expected_lamports / LAMPORTS_PER_SOL;
      const credited = creditGridironCashPurchase(verifiedSol, sig);
      const cash = verified.gc_amount;
      toast.success(`Purchased ${cash.toLocaleString()} Gridiron Cash`, {
        id: sig,
        description: `tx ${sig.slice(0, 8)}…`,
        action: {
          label: "View",
          onClick: () => window.open(`https://solscan.io/tx/${sig}?cluster=devnet`, "_blank"),
        },
      });
      if (credited === 0) toast.info("This verified purchase was already credited on this device.");
      const lam = await connection.getBalance(publicKey);
      setBalance(lam / LAMPORTS_PER_SOL);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Deposit failed");
    } finally {
      setBusy(false);
      setPurchaseStep(null);
    }
  }

  const amt = Number(amount) || 0;
  const usdPreview = (amt * solUsd).toFixed(2);
  const inGameSol = state.sol ?? 0;
  const cashPreview = Math.round(amt * GRIDIRON_CASH_PER_SOL);

  return (
    <div className="animate-float-up space-y-6">
      <section className="rounded-2xl border border-border/70 bg-card/80 p-6 shadow-[var(--shadow-card)]">
        <div className="text-[11px] uppercase tracking-[0.3em] text-primary/80">
          Franchise Wallet
        </div>
        <h1 className="mt-1 font-display text-3xl">Fund your dynasty</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Connect Phantom or Solflare to purchase Gridiron Cash with SOL.
        </p>

        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-border/70 bg-background/50 p-3">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
              In-game SOL
            </div>
            <div className="mt-1 font-display text-2xl text-gradient-gold">
              ◎ {inGameSol.toFixed(4)}
            </div>
            <div className="mt-0.5 text-[10px] text-muted-foreground">
              ≈ ${(inGameSol * solUsd).toFixed(2)} USD
            </div>
          </div>
          <div className="rounded-xl border border-border/70 bg-background/50 p-3">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Coins</div>
            <div className="mt-1 font-display text-2xl">🪙 {state.coins.toFixed(2)}</div>
            <div className="mt-0.5 text-[10px] text-muted-foreground">Earned from fans</div>
          </div>
          <div className="rounded-xl border border-fuchsia-500/30 bg-fuchsia-500/10 p-3">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
              Gridiron Cash
            </div>
            <div className="mt-1 flex items-center gap-2 font-display text-2xl text-fuchsia-300">
              <img src="/gc-icon.png" alt="" className="h-8 w-8 object-contain" />
              {(state.gridironCash ?? 0).toLocaleString()}
            </div>
            <div className="mt-0.5 text-[10px] text-muted-foreground">Premium packs and offers</div>
          </div>
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
              Season pool
            </div>
            <div className="mt-1 font-display text-2xl text-emerald-300">
              ◎ {(state.currentPrizePoolSol ?? 250).toFixed(2)}
            </div>
            <div className="mt-0.5 text-[10px] text-muted-foreground">
              60% of eligible purchases
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-border/70 bg-card/80 p-6 shadow-[var(--shadow-card)]">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">
              Wallet
            </div>
            <h2 className="mt-1 font-display text-xl">
              {connected ? wallet?.adapter.name : "Not connected"}
            </h2>
          </div>
          {connected && (
            <button
              onClick={() => disconnect()}
              className="rounded-lg border border-border bg-secondary px-3 py-1.5 text-xs"
            >
              Disconnect
            </button>
          )}
        </div>

        {!connected ? (
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {wallets.map((w) => (
              <button
                key={w.adapter.name}
                onClick={() => pick(w.adapter.name)}
                disabled={connecting}
                className="flex items-center gap-3 rounded-xl border border-border/70 bg-background/60 p-3 text-left hover:border-primary/60 disabled:opacity-50"
              >
                {w.adapter.icon && (
                  <img src={w.adapter.icon} alt="" className="h-8 w-8 rounded-md" />
                )}
                <div className="flex-1">
                  <div className="font-semibold">{w.adapter.name}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {w.readyState === "Installed" || w.readyState === "Loadable"
                      ? "Ready"
                      : "Not detected"}
                  </div>
                </div>
                <span className="text-xs text-primary">Connect →</span>
              </button>
            ))}
            <div className="text-[11px] text-muted-foreground sm:col-span-2">
              Don't have one? Install{" "}
              <a
                className="text-primary underline"
                href="https://phantom.app/download"
                target="_blank"
                rel="noreferrer"
              >
                Phantom
              </a>
              {" or "}
              <a
                className="text-primary underline"
                href="https://solflare.com/download"
                target="_blank"
                rel="noreferrer"
              >
                Solflare
              </a>
              .
            </div>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between rounded-lg border border-border/70 bg-background/50 px-3 py-2 text-sm">
              <span className="text-muted-foreground">Address</span>
              <span className="font-mono">{publicKey && short(publicKey.toBase58())}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border/70 bg-background/50 px-3 py-2 text-sm">
              <span className="text-muted-foreground">On-chain balance</span>
              <span className="tabular-nums">
                ◎ {balance == null ? "…" : balance.toFixed(4)}
                {balance != null && solUsd > 0 && (
                  <span className="ml-2 text-[11px] text-muted-foreground">
                    ≈ ${(balance * solUsd).toFixed(2)}
                  </span>
                )}
              </span>
            </div>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-border/70 bg-card/80 p-6 shadow-[var(--shadow-card)]">
        <div className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">
          Gridiron Cash
        </div>
        <h2 className="mt-1 font-display text-xl">Purchase premium currency</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          1 SOL purchases {GRIDIRON_CASH_PER_SOL.toLocaleString()} GC. SOL is transferred to the
          franchise treasury on {(import.meta.env.VITE_SOLANA_NETWORK as string) || "mainnet-beta"}.
        </p>

        {!TREASURY_WALLET && (
          <div className="mt-3 rounded-lg border border-yellow-500/40 bg-yellow-500/10 p-3 text-xs text-yellow-200">
            Treasury address isn't configured yet. The app owner needs to set{" "}
            <code>VITE_TREASURY_WALLET</code> before deposits can go through.
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          {QUICK.map((q) => (
            <button
              key={q}
              onClick={() => setAmount(String(q))}
              className={`rounded-full border px-3 py-1 text-xs ${
                Number(amount) === q
                  ? "border-primary text-primary"
                  : "border-border/70 text-muted-foreground"
              }`}
            >
              ◎ {q}
            </button>
          ))}
        </div>

        <div className="mt-3 flex items-stretch gap-2">
          <div className="flex-1 rounded-lg border border-border/70 bg-background/60 px-3 py-2">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
              Amount (SOL)
            </div>
            <input
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="mt-0.5 w-full bg-transparent font-display text-2xl outline-none"
            />
            <div className="text-[10px] text-muted-foreground">≈ ${usdPreview} USD</div>
            <div className="mt-1 font-semibold text-fuchsia-300">
              You receive GC {cashPreview.toLocaleString()}
            </div>
          </div>
          <button
            onClick={deposit}
            disabled={!connected || busy || !TREASURY_WALLET}
            className="rounded-lg bg-[image:var(--gradient-gold)] px-5 font-semibold text-primary-foreground shadow-[var(--shadow-glow)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? "Processing…" : connected ? "Buy Gridiron Cash" : "Connect wallet"}
          </button>
        </div>
        {purchaseStep && (
          <div className="mt-3 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-xs text-primary">
            {purchaseStep}
          </div>
        )}
        <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-2">
            <strong className="block text-emerald-300">60%</strong>Current pool
            <br />◎ {(amt * 0.6).toFixed(3)}
          </div>
          <div className="rounded-lg border border-sky-500/30 bg-sky-500/10 p-2">
            <strong className="block text-sky-300">20%</strong>Next season
            <br />◎ {(amt * 0.2).toFixed(3)}
          </div>
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-2">
            <strong className="block text-amber-300">20%</strong>Development
            <br />◎ {(amt * 0.2).toFixed(3)}
          </div>
        </div>
        <p className="mt-3 text-[10px] text-muted-foreground">
          Purchases are credited only after the server verifies the sender, treasury, amount,
          confirmation, and unique transaction signature.
        </p>
      </section>

      <section className="rounded-2xl border border-border/70 bg-card/80 p-6 shadow-[var(--shadow-card)]">
        <div className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">
          Treasury allocation
        </div>
        <h2 className="mt-1 font-display text-xl">60 / 20 / 20 ledger</h2>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg bg-emerald-500/10 p-3">
            <div className="text-[10px] text-muted-foreground">CURRENT POOL</div>
            <div className="font-display text-lg text-emerald-300">
              ◎ {(state.currentPrizePoolSol ?? 250).toFixed(3)}
            </div>
          </div>
          <div className="rounded-lg bg-sky-500/10 p-3">
            <div className="text-[10px] text-muted-foreground">NEXT SEASON</div>
            <div className="font-display text-lg text-sky-300">
              ◎ {(state.nextSeasonPoolSol ?? 0).toFixed(3)}
            </div>
          </div>
          <div className="rounded-lg bg-amber-500/10 p-3">
            <div className="text-[10px] text-muted-foreground">DEVELOPMENT</div>
            <div className="font-display text-lg text-amber-300">
              ◎ {(state.devTreasurySol ?? 0).toFixed(3)}
            </div>
          </div>
        </div>
        <div className="mt-4 space-y-2">
          {(state.cashPurchases ?? []).length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-3 text-center text-xs text-muted-foreground">
              No Gridiron Cash purchases yet.
            </div>
          ) : (
            (state.cashPurchases ?? []).slice(0, 5).map((purchase) => (
              <div
                key={purchase.id}
                className="flex items-center justify-between rounded-lg border border-border/60 bg-background/40 px-3 py-2 text-xs"
              >
                <div>
                  <strong>GC {purchase.cash.toLocaleString()}</strong>
                  <div className="text-[10px] text-muted-foreground">
                    {new Date(purchase.createdAt).toLocaleString()}
                  </div>
                </div>
                <div className="text-right tabular-nums">
                  ◎ {purchase.sol.toFixed(3)}
                  <div className="text-[10px] text-muted-foreground">60% / 20% / 20%</div>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
