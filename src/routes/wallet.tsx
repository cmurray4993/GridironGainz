import { createFileRoute } from "@tanstack/react-router";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { LAMPORTS_PER_SOL, PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { addSol, setWalletAddress, useGame } from "@/lib/game/store";
import { TREASURY_WALLET } from "@/lib/solana/WalletProvider";
import { getSolUsd } from "@/lib/solana/price";

export const Route = createFileRoute("/wallet")({
  component: WalletPage,
  head: () => ({
    meta: [
      { title: "Wallet — Fourth & Fortune" },
      { name: "description", content: "Connect Phantom or Solflare and fund your Fourth & Fortune franchise with SOL." },
    ],
  }),
});

const QUICK = [0.05, 0.1, 0.5, 1];

function short(addr: string) {
  return addr.slice(0, 4) + "…" + addr.slice(-4);
}

function WalletPage() {
  const state = useGame();
  const { connection } = useConnection();
  const { wallets, wallet, publicKey, connected, connecting, select, connect, disconnect, sendTransaction } = useWallet();

  const [balance, setBalance] = useState<number | null>(null);
  const [solUsd, setSolUsd] = useState<number>(0);
  const [amount, setAmount] = useState<string>("0.1");
  const [busy, setBusy] = useState(false);

  useEffect(() => { getSolUsd().then(setSolUsd); }, []);

  useEffect(() => {
    if (!publicKey) { setBalance(null); return; }
    setWalletAddress(publicKey.toBase58());
    let cancelled = false;
    connection.getBalance(publicKey).then((lam) => {
      if (!cancelled) setBalance(lam / LAMPORTS_PER_SOL);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [publicKey, connection]);

  async function pick(name: string) {
    try {
      select(name as any);
      // Give adapter a tick to attach, then request connect.
      setTimeout(() => { connect().catch((e) => toast.error(e?.message ?? "Connect failed")); }, 50);
    } catch (e: any) {
      toast.error(e?.message ?? "Connect failed");
    }
  }

  async function deposit() {
    if (!publicKey) return;
    const amt = Number(amount);
    if (!amt || amt <= 0) { toast.error("Enter an amount"); return; }
    if (!TREASURY_WALLET) { toast.error("Treasury not configured"); return; }
    let treasury: PublicKey;
    try { treasury = new PublicKey(TREASURY_WALLET); }
    catch { toast.error("Invalid treasury address"); return; }
    setBusy(true);
    try {
      const tx = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: treasury,
          lamports: Math.round(amt * LAMPORTS_PER_SOL),
        }),
      );
      const sig = await sendTransaction(tx, connection);
      toast.loading("Confirming deposit…", { id: sig });
      const latest = await connection.getLatestBlockhash();
      await connection.confirmTransaction({ signature: sig, ...latest }, "confirmed");
      addSol(amt);
      toast.success(`Deposited ◎${amt} — credited to your franchise`, {
        id: sig,
        description: `tx ${sig.slice(0, 8)}…`,
        action: { label: "View", onClick: () => window.open(`https://solscan.io/tx/${sig}`, "_blank") },
      });
      // Refresh on-chain balance
      const lam = await connection.getBalance(publicKey);
      setBalance(lam / LAMPORTS_PER_SOL);
    } catch (e: any) {
      toast.error(e?.message ?? "Deposit failed");
    } finally {
      setBusy(false);
    }
  }

  const amt = Number(amount) || 0;
  const usdPreview = (amt * solUsd).toFixed(2);
  const inGameSol = state.sol ?? 0;

  return (
    <div className="animate-float-up space-y-6">
      <section className="rounded-2xl border border-border/70 bg-card/80 p-6 shadow-[var(--shadow-card)]">
        <div className="text-[11px] uppercase tracking-[0.3em] text-primary/80">Franchise Wallet</div>
        <h1 className="mt-1 font-display text-3xl">Fund your dynasty</h1>
        <p className="mt-1 text-sm text-muted-foreground">Connect Phantom or Solflare to deposit SOL into your franchise treasury.</p>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-border/70 bg-background/50 p-3">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">In-game SOL</div>
            <div className="mt-1 font-display text-2xl text-gradient-gold">◎ {inGameSol.toFixed(4)}</div>
            <div className="mt-0.5 text-[10px] text-muted-foreground">≈ ${(inGameSol * solUsd).toFixed(2)} USD</div>
          </div>
          <div className="rounded-xl border border-border/70 bg-background/50 p-3">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Coins</div>
            <div className="mt-1 font-display text-2xl">🪙 {state.coins.toFixed(2)}</div>
            <div className="mt-0.5 text-[10px] text-muted-foreground">Earned from fans</div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-border/70 bg-card/80 p-6 shadow-[var(--shadow-card)]">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">Wallet</div>
            <h2 className="mt-1 font-display text-xl">{connected ? wallet?.adapter.name : "Not connected"}</h2>
          </div>
          {connected && (
            <button onClick={() => disconnect()} className="rounded-lg border border-border bg-secondary px-3 py-1.5 text-xs">
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
                    {w.readyState === "Installed" || w.readyState === "Loadable" ? "Ready" : "Not detected"}
                  </div>
                </div>
                <span className="text-xs text-primary">Connect →</span>
              </button>
            ))}
            <div className="text-[11px] text-muted-foreground sm:col-span-2">
              Don't have one? Install{" "}
              <a className="text-primary underline" href="https://phantom.app/download" target="_blank" rel="noreferrer">Phantom</a>
              {" or "}
              <a className="text-primary underline" href="https://solflare.com/download" target="_blank" rel="noreferrer">Solflare</a>.
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
                  <span className="ml-2 text-[11px] text-muted-foreground">≈ ${(balance * solUsd).toFixed(2)}</span>
                )}
              </span>
            </div>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-border/70 bg-card/80 p-6 shadow-[var(--shadow-card)]">
        <div className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">Deposit</div>
        <h2 className="mt-1 font-display text-xl">Add funds</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          SOL is transferred from your wallet to the franchise treasury on Solana {(import.meta.env.VITE_SOLANA_NETWORK as string) || "mainnet-beta"}.
        </p>

        {!TREASURY_WALLET && (
          <div className="mt-3 rounded-lg border border-yellow-500/40 bg-yellow-500/10 p-3 text-xs text-yellow-200">
            Treasury address isn't configured yet. The app owner needs to set <code>VITE_TREASURY_WALLET</code> before deposits can go through.
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          {QUICK.map((q) => (
            <button
              key={q}
              onClick={() => setAmount(String(q))}
              className={`rounded-full border px-3 py-1 text-xs ${
                Number(amount) === q ? "border-primary text-primary" : "border-border/70 text-muted-foreground"
              }`}
            >
              ◎ {q}
            </button>
          ))}
        </div>

        <div className="mt-3 flex items-stretch gap-2">
          <div className="flex-1 rounded-lg border border-border/70 bg-background/60 px-3 py-2">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Amount (SOL)</div>
            <input
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="mt-0.5 w-full bg-transparent font-display text-2xl outline-none"
            />
            <div className="text-[10px] text-muted-foreground">≈ ${usdPreview} USD</div>
          </div>
          <button
            onClick={deposit}
            disabled={!connected || busy || !TREASURY_WALLET}
            className="rounded-lg bg-[image:var(--gradient-gold)] px-5 font-semibold text-primary-foreground shadow-[var(--shadow-glow)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? "Sending…" : connected ? "Deposit" : "Connect wallet"}
          </button>
        </div>
      </section>
    </div>
  );
}
