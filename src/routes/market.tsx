import { Buffer } from "buffer";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { LAMPORTS_PER_SOL, PublicKey, SystemProgram, Transaction, TransactionInstruction } from "@solana/web3.js";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { PlayerCard } from "@/components/PlayerCard";
import { useAuth } from "@/hooks/useAuth";
import {
  addMarketPlayer,
  removeMarketPlayer,
  sellPlayer,
  sellPrice,
  setMarketCoinBalance,
  useGame,
} from "@/lib/game/store";
import type { Player, Position } from "@/lib/game/types";
import {
  bootstrapMarketAccount,
  browseMarket,
  buyMarketListingCoins,
  cancelMarketListing,
  createMarketListing,
  createSolMarketIntent,
  getOwnedMarketCards,
  placeMarketBid,
  settleExpiredMarketListings,
  verifySolMarketPurchase,
  type MarketListing,
} from "@/lib/marketplace";
import { SolanaWalletProvider } from "@/lib/solana/WalletProvider";

export const Route = createFileRoute("/market")({
  component: MarketPage,
  head: () => ({ meta: [{ title: "Auction House — Gridiron Gainz" }] }),
});

type Tab = "browse" | "list" | "quick";
type ListingMode = "auction" | "coins" | "sol";

function MarketPage() {
  return (
    <SolanaWalletProvider>
      <MarketPanel />
    </SolanaWalletProvider>
  );
}

function MarketPanel() {
  const state = useGame();
  const { user } = useAuth();
  const userId = user?.id;
  const { connection } = useConnection();
  const { wallets, publicKey, connected, connecting, select, connect, sendTransaction } = useWallet();
  const [tab, setTab] = useState<Tab>("browse");
  const [listings, setListings] = useState<MarketListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [filter, setFilter] = useState<Position | "ALL">("ALL");
  const [selected, setSelected] = useState<Player | null>(null);
  const [mode, setMode] = useState<ListingMode>("auction");
  const [price, setPrice] = useState("500");
  const [duration, setDuration] = useState("24");
  const [bids, setBids] = useState<Record<string, string>>({});
  const initialMarketCoins = useRef(state.coins);

  const lineupIds = useMemo(
    () => new Set(Object.values(state.lineup).filter((id): id is string => Boolean(id))),
    [state.lineup],
  );

  const refresh = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      await settleExpiredMarketListings();
      const [market, balance, ownedCards] = await Promise.all([
        browseMarket(),
        bootstrapMarketAccount(initialMarketCoins.current),
        getOwnedMarketCards(),
      ]);
      ownedCards.forEach(addMarketPlayer);
      setListings(market);
      setMarketCoinBalance(balance);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load the auction house");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function connectWallet(name: string) {
    try {
      select(name as never);
      setTimeout(() => connect().catch((e) => toast.error(e?.message ?? "Connect failed")), 50);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Connect failed");
    }
  }

  async function listCard() {
    if (!selected) return;
    const amount = Number(price);
    if (!Number.isFinite(amount) || amount <= 0) return toast.error("Enter a valid price");
    if (lineupIds.has(selected.id)) return toast.error("Remove this player from your lineup first");
    if (mode === "sol" && !publicKey) return toast.error("Connect the seller wallet first");
    setBusy("listing");
    try {
      await createMarketListing(selected, {
        currency: mode === "sol" ? "sol" : "coins",
        saleType: mode === "auction" ? "auction" : "buy_now",
        startingPrice: mode === "auction" ? Math.floor(amount) : undefined,
        buyNowPrice: mode === "coins" ? Math.floor(amount) : undefined,
        solLamports: mode === "sol" ? Math.round(amount * LAMPORTS_PER_SOL) : undefined,
        sellerWallet: mode === "sol" ? publicKey?.toBase58() : undefined,
        durationHours: Number(duration),
      });
      removeMarketPlayer(selected.id);
      setSelected(null);
      setTab("browse");
      toast.success(`${selected.name} is now listed`);
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Listing failed");
    } finally {
      setBusy(null);
    }
  }

  async function bid(listing: MarketListing) {
    const minimum = Math.max(listing.starting_price ?? 1, (listing.current_bid ?? 0) + 1);
    const amount = Number(bids[listing.id] || minimum);
    setBusy(listing.id);
    try {
      const result = await placeMarketBid(listing.id, amount);
      setMarketCoinBalance(Number(result.balance));
      toast.success(`Bid placed: 🪙 ${amount.toLocaleString()}`);
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Bid failed");
    } finally {
      setBusy(null);
    }
  }

  async function buyCoins(listing: MarketListing) {
    setBusy(listing.id);
    try {
      const result = await buyMarketListingCoins(listing.id);
      addMarketPlayer(result.card);
      setMarketCoinBalance(result.balance);
      toast.success(`${result.card.name} joined your roster`);
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Purchase failed");
    } finally {
      setBusy(null);
    }
  }

  async function buySol(listing: MarketListing) {
    if (!publicKey) return toast.error("Connect a buyer wallet first");
    setBusy(listing.id);
    try {
      const intent = await createSolMarketIntent(listing.id, publicKey.toBase58());
      const seller = new PublicKey(intent.sellerWallet);
      if (publicKey.equals(seller)) throw new Error("Buyer and seller wallets must be different");
      const memoProgram = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");
      const tx = new Transaction().add(
        SystemProgram.transfer({ fromPubkey: publicKey, toPubkey: seller, lamports: intent.expectedLamports }),
        new TransactionInstruction({ keys: [], programId: memoProgram, data: Buffer.from(intent.memo, "utf8") as never }),
      );
      const latest = await connection.getLatestBlockhash("confirmed");
      tx.recentBlockhash = latest.blockhash;
      tx.feePayer = publicKey;
      const signature = await sendTransaction(tx, connection);
      toast.loading("Verifying devnet SOL payment…", { id: signature });
      await connection.confirmTransaction({ signature, ...latest }, "confirmed");
      const verified = await verifySolMarketPurchase(intent.purchaseId, signature);
      if (!verified.card) throw new Error("Card settlement did not complete");
      addMarketPlayer(verified.card);
      toast.success(`${verified.card.name} joined your roster`, { id: signature });
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "SOL purchase failed");
    } finally {
      setBusy(null);
    }
  }

  async function cancel(listing: MarketListing) {
    setBusy(listing.id);
    try {
      const card = await cancelMarketListing(listing.id);
      addMarketPlayer(card);
      toast.success("Listing cancelled and card returned");
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not cancel listing");
    } finally {
      setBusy(null);
    }
  }

  const shownListings = listings.filter(
    (listing) => filter === "ALL" || listing.card_data.position === filter,
  );

  return (
    <div className="animate-float-up space-y-5 pb-24">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-[0.3em] text-primary/80">Player Market</div>
          <h1 className="mt-1 font-display text-3xl">Auction House</h1>
          <p className="text-sm text-muted-foreground">Bid, buy instantly, or trade cards for verified devnet SOL.</p>
        </div>
        <div className="rounded-xl border border-primary/30 bg-card/80 px-4 py-2 text-right">
          <div className="text-[9px] uppercase tracking-widest text-muted-foreground">Market balance</div>
          <div className="font-display text-xl text-gradient-gold">🪙 {Math.floor(state.coins).toLocaleString()}</div>
        </div>
      </header>

      <div className="rounded-lg border border-sky-500/30 bg-sky-500/10 px-3 py-2 text-xs text-sky-100">
        SOL listings are devnet-only during testing. No real-money or mainnet purchase is enabled.
      </div>

      <div className="flex rounded-xl border border-border/70 bg-card/70 p-1">
        {(["browse", "list", "quick"] as Tab[]).map((value) => (
          <button key={value} onClick={() => setTab(value)} className={`flex-1 rounded-lg px-3 py-2 text-xs font-semibold uppercase tracking-wider ${tab === value ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
            {value === "browse" ? "Browse" : value === "list" ? "List a card" : "Quick sell"}
          </button>
        ))}
      </div>

      {tab === "browse" && (
        <>
          <div className="flex flex-wrap gap-1.5">
            {(["ALL", "QB", "RB", "WR", "TE", "OL", "DL", "LB", "DB", "K", "P"] as const).map((position) => (
              <button key={position} onClick={() => setFilter(position)} className={`rounded-full border px-3 py-1 text-xs ${filter === position ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground"}`}>{position}</button>
            ))}
            <button onClick={() => void refresh()} className="ml-auto rounded-full border border-border px-3 py-1 text-xs">Refresh</button>
          </div>
          {loading ? (
            <Empty text="Loading live listings…" />
          ) : shownListings.length === 0 ? (
            <Empty text="No active listings yet. Be the first GM to list a card." />
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {shownListings.map((listing) => {
                const mine = listing.seller_id === user?.id;
                const minimum = Math.max(listing.starting_price ?? 1, (listing.current_bid ?? 0) + 1);
                return (
                  <article key={listing.id} className="rounded-xl border border-border/70 bg-card/75 p-2">
                    <PlayerCard player={listing.card_data} />
                    <div className="mt-2 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="uppercase text-muted-foreground">{listing.sale_type === "auction" ? "Current bid" : "Buy now"}</span>
                        <strong>{listing.currency === "sol" ? `◎ ${((listing.sol_lamports ?? 0) / LAMPORTS_PER_SOL).toFixed(3)}` : `🪙 ${(listing.sale_type === "auction" ? listing.current_bid ?? listing.starting_price : listing.buy_now_price)?.toLocaleString()}`}</strong>
                      </div>
                      <div className="text-[10px] text-muted-foreground">Ends {new Date(listing.expires_at).toLocaleString()}</div>
                      {mine ? (
                        <button disabled={busy === listing.id || Boolean(listing.high_bidder_id)} onClick={() => void cancel(listing)} className="w-full rounded-lg border border-border py-2 text-xs disabled:opacity-40">Cancel listing</button>
                      ) : listing.sale_type === "auction" ? (
                        <div className="flex gap-1">
                          <input type="number" min={minimum} value={bids[listing.id] ?? minimum} onChange={(e) => setBids((old) => ({ ...old, [listing.id]: e.target.value }))} className="min-w-0 flex-1 rounded-md border border-border bg-background px-2 text-xs" />
                          <button disabled={busy === listing.id} onClick={() => void bid(listing)} className="rounded-md bg-primary px-2 py-2 text-xs font-semibold text-primary-foreground">Bid</button>
                        </div>
                      ) : listing.currency === "coins" ? (
                        <button disabled={busy === listing.id} onClick={() => void buyCoins(listing)} className="w-full rounded-lg bg-primary py-2 text-xs font-semibold text-primary-foreground">Buy now</button>
                      ) : connected ? (
                        <button disabled={busy === listing.id} onClick={() => void buySol(listing)} className="w-full rounded-lg bg-violet-600 py-2 text-xs font-semibold text-white">Buy with devnet SOL</button>
                      ) : (
                        <WalletButtons wallets={wallets} connecting={connecting} onConnect={connectWallet} />
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </>
      )}

      {tab === "list" && (
        <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
          <section>
            <h2 className="font-display text-xl">Choose a bench card</h2>
            <p className="mb-3 text-xs text-muted-foreground">Starting-lineup cards must be removed from the lineup before listing.</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {state.roster.map((player) => (
                <button key={player.id} disabled={lineupIds.has(player.id)} onClick={() => setSelected(player)} className={`text-left ${lineupIds.has(player.id) ? "opacity-35" : ""}`}>
                  <PlayerCard player={player} selected={selected?.id === player.id} />
                </button>
              ))}
            </div>
          </section>
          <aside className="h-fit rounded-2xl border border-border/70 bg-card/80 p-4 lg:sticky lg:top-4">
            <h2 className="font-display text-xl">Listing details</h2>
            <div className="mt-3 grid grid-cols-3 gap-1">
              <ModeButton active={mode === "auction"} onClick={() => setMode("auction")} label="Coin bid" />
              <ModeButton active={mode === "coins"} onClick={() => setMode("coins")} label="Coin buy" />
              <ModeButton active={mode === "sol"} onClick={() => setMode("sol")} label="SOL buy" />
            </div>
            {mode === "sol" && !connected && <WalletButtons wallets={wallets} connecting={connecting} onConnect={connectWallet} />}
            <label className="mt-4 block text-[10px] uppercase tracking-widest text-muted-foreground">{mode === "sol" ? "Price in devnet SOL" : mode === "auction" ? "Starting bid" : "Buy-now price"}</label>
            <input type="number" min="0.001" step={mode === "sol" ? "0.001" : "1"} value={price} onChange={(e) => setPrice(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2" />
            <label className="mt-3 block text-[10px] uppercase tracking-widest text-muted-foreground">Duration</label>
            <select value={duration} onChange={(e) => setDuration(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2">
              <option value="12">12 hours</option><option value="24">24 hours</option><option value="48">48 hours</option><option value="72">72 hours</option>
            </select>
            <button disabled={!selected || busy === "listing" || (mode === "sol" && !connected)} onClick={() => void listCard()} className="mt-4 w-full rounded-lg bg-[image:var(--gradient-gold)] py-2.5 font-semibold text-primary-foreground disabled:opacity-40">{busy === "listing" ? "Listing…" : selected ? `List ${selected.name}` : "Select a card"}</button>
          </aside>
        </div>
      )}

      {tab === "quick" && <QuickSell roster={state.roster} lineupIds={lineupIds} />}
    </div>
  );
}

function WalletButtons({ wallets, connecting, onConnect }: { wallets: ReturnType<typeof useWallet>["wallets"]; connecting: boolean; onConnect: (name: string) => void }) {
  return <div className="mt-2 grid gap-1">{wallets.slice(0, 2).map((wallet) => <button key={wallet.adapter.name} disabled={connecting} onClick={() => onConnect(wallet.adapter.name)} className="rounded-lg border border-violet-500/40 bg-violet-500/10 px-2 py-2 text-xs">Connect {wallet.adapter.name}</button>)}</div>;
}

function ModeButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return <button onClick={onClick} className={`rounded-lg border px-2 py-2 text-[10px] font-semibold ${active ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}>{label}</button>;
}

function Empty({ text }: { text: string }) {
  return <div className="rounded-2xl border border-dashed border-border/70 p-10 text-center text-sm text-muted-foreground">{text}</div>;
}

function QuickSell({ roster, lineupIds }: { roster: Player[]; lineupIds: Set<string> }) {
  if (roster.length === 0) return <Empty text="No cards available. Open a pack first." />;
  return <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">{roster.map((player) => {
    const locked = lineupIds.has(player.id);
    return <div key={player.id}><PlayerCard player={player} /><button disabled={locked} onClick={() => { const amount = sellPlayer(player.id); toast.success(`${player.name} quick-sold for ${amount} coins`); }} className="mt-2 w-full rounded-lg border border-border bg-card py-2 text-xs disabled:opacity-40">{locked ? "In lineup" : `Quick sell · 🪙 ${sellPrice(player)}`}</button></div>;
  })}</div>;
}
