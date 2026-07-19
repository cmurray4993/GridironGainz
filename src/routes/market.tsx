import { Buffer } from "buffer";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { LAMPORTS_PER_SOL, PublicKey, SystemProgram, Transaction, TransactionInstruction } from "@solana/web3.js";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { PlayerCard } from "@/components/PlayerCard";
import { useAuth } from "@/hooks/useAuth";
import { addMarketPlayer, setMarketCoinBalance, useGame } from "@/lib/game/store";
import type { Position } from "@/lib/game/types";
import { bootstrapMarketAccount, browseMarket, buyMarketListingCoins, cancelMarketListing, createSolMarketIntent, getOwnedMarketCards, placeMarketBid, settleExpiredMarketListings, verifySolMarketPurchase, type MarketListing } from "@/lib/marketplace";
import { SolanaWalletProvider } from "@/lib/solana/WalletProvider";

export const Route = createFileRoute("/market")({ component: MarketPage, head: () => ({ meta: [{ title: "Auction House — Gridiron Gainz" }] }) });

function MarketPage() { return <SolanaWalletProvider><MarketPanel /></SolanaWalletProvider>; }

function MarketPanel() {
  const state = useGame(); const { user } = useAuth(); const { connection } = useConnection();
  const { wallets, publicKey, connected, connecting, select, connect, sendTransaction } = useWallet();
  const [listings, setListings] = useState<MarketListing[]>([]); const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null); const [filter, setFilter] = useState<Position | "ALL">("ALL");
  const [bids, setBids] = useState<Record<string, string>>({}); const initialMarketCoins = useRef(state.coins);
  const refresh = useCallback(async () => {
    if (!user?.id) return; setLoading(true);
    try {
      await settleExpiredMarketListings();
      const [market, balance, owned] = await Promise.all([browseMarket(), bootstrapMarketAccount(initialMarketCoins.current), getOwnedMarketCards()]);
      owned.forEach(addMarketPlayer); setListings(market); setMarketCoinBalance(balance);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not load the auction house"); }
    finally { setLoading(false); }
  }, [user?.id]);
  useEffect(() => { void refresh(); }, [refresh]);
  async function connectWallet(name: string) { try { select(name as never); setTimeout(() => connect().catch((e) => toast.error(e?.message ?? "Connect failed")), 50); } catch (e) { toast.error(e instanceof Error ? e.message : "Connect failed"); } }
  async function bid(listing: MarketListing) { const minimum = Math.max(listing.starting_price ?? 1, (listing.current_bid ?? 0) + 1); const amount = Number(bids[listing.id] || minimum); setBusy(listing.id); try { const result = await placeMarketBid(listing.id, amount); setMarketCoinBalance(Number(result.balance)); toast.success(`Bid placed: 🪙 ${amount.toLocaleString()}`); await refresh(); } catch (e) { toast.error(e instanceof Error ? e.message : "Bid failed"); } finally { setBusy(null); } }
  async function buyCoins(listing: MarketListing) { setBusy(listing.id); try { const result = await buyMarketListingCoins(listing.id); addMarketPlayer(result.card); setMarketCoinBalance(result.balance); toast.success(`${result.card.name} joined your roster`); await refresh(); } catch (e) { toast.error(e instanceof Error ? e.message : "Purchase failed"); } finally { setBusy(null); } }
  async function buySol(listing: MarketListing) {
    if (!publicKey) return toast.error("Connect a buyer wallet first"); setBusy(listing.id);
    try { const intent = await createSolMarketIntent(listing.id, publicKey.toBase58()); const seller = new PublicKey(intent.sellerWallet); if (publicKey.equals(seller)) throw new Error("Buyer and seller wallets must be different");
      const memoProgram = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");
      const tx = new Transaction().add(SystemProgram.transfer({ fromPubkey: publicKey, toPubkey: seller, lamports: intent.expectedLamports }), new TransactionInstruction({ keys: [], programId: memoProgram, data: Buffer.from(intent.memo, "utf8") as never }));
      const latest = await connection.getLatestBlockhash("confirmed"); tx.recentBlockhash = latest.blockhash; tx.feePayer = publicKey; const signature = await sendTransaction(tx, connection);
      toast.loading("Verifying devnet SOL payment…", { id: signature }); await connection.confirmTransaction({ signature, ...latest }, "confirmed"); const verified = await verifySolMarketPurchase(intent.purchaseId, signature); if (!verified.card) throw new Error("Card settlement did not complete");
      addMarketPlayer(verified.card); toast.success(`${verified.card.name} joined your roster`, { id: signature }); await refresh();
    } catch (e) { toast.error(e instanceof Error ? e.message : "SOL purchase failed"); } finally { setBusy(null); }
  }
  async function cancel(listing: MarketListing) { setBusy(listing.id); try { const card = await cancelMarketListing(listing.id); addMarketPlayer(card); toast.success("Listing cancelled and card returned"); await refresh(); } catch (e) { toast.error(e instanceof Error ? e.message : "Could not cancel listing"); } finally { setBusy(null); } }
  const shown = listings.filter((l) => filter === "ALL" || l.card_data.position === filter);
  return <div className="animate-float-up space-y-5 pb-24">
    <header className="flex flex-wrap items-end justify-between gap-3"><div><div className="text-[11px] uppercase tracking-[0.3em] text-primary/80">Player Market</div><h1 className="mt-1 font-display text-3xl">Auction House</h1><p className="text-sm text-muted-foreground">Browse, bid, or buy. List cards from Team → Roster.</p></div><div className="rounded-xl border border-primary/30 bg-card/80 px-4 py-2 text-right"><div className="text-[9px] uppercase tracking-widest text-muted-foreground">Market balance</div><div className="font-display text-xl text-gradient-gold">🪙 {Math.floor(state.coins).toLocaleString()}</div></div></header>
    <div className="flex items-center justify-between gap-3 rounded-lg border border-sky-500/30 bg-sky-500/10 px-3 py-2 text-xs text-sky-100"><span>SOL purchases use devnet only during testing. A Buy Now sale automatically refunds any active coin bidder.</span><Link to="/roster" className="shrink-0 rounded-md bg-primary px-3 py-1.5 font-semibold text-primary-foreground">Manage my cards</Link></div>
    <div className="flex flex-wrap gap-1.5">{(["ALL","QB","RB","WR","TE","OL","DL","LB","DB","K","P"] as const).map((p) => <button key={p} onClick={() => setFilter(p)} className={`rounded-full border px-3 py-1 text-xs ${filter === p ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground"}`}>{p}</button>)}<button onClick={() => void refresh()} className="ml-auto rounded-full border border-border px-3 py-1 text-xs">Refresh</button></div>
    {loading ? <Empty text="Loading live listings…" /> : shown.length === 0 ? <Empty text="No active listings match this filter." /> : <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{shown.map((listing) => {
      const mine = listing.seller_id === user?.id; const minimum = Math.max(listing.starting_price ?? 1, (listing.current_bid ?? 0) + 1);
      return <article key={listing.id} className="rounded-xl border border-border/70 bg-card/75 p-2"><PlayerCard player={listing.card_data}/><div className="mt-2 space-y-2">
        {listing.starting_price != null && <div className="rounded-lg border border-border p-2"><div className="flex justify-between text-xs"><span className="text-muted-foreground">{listing.current_bid ? "Current bid" : "Starting bid"}</span><b>🪙 {(listing.current_bid ?? listing.starting_price).toLocaleString()}</b></div>{!mine && <div className="mt-2 flex gap-1"><input type="number" min={minimum} value={bids[listing.id] ?? minimum} onChange={(e) => setBids((old) => ({...old,[listing.id]:e.target.value}))} className="min-w-0 flex-1 rounded-md border border-border bg-background px-2 text-xs"/><button disabled={busy === listing.id} onClick={() => void bid(listing)} className="rounded-md bg-primary px-2 py-2 text-xs font-semibold text-primary-foreground">Bid</button></div>}</div>}
        {!mine && listing.buy_now_price != null && <button disabled={busy === listing.id} onClick={() => void buyCoins(listing)} className="w-full rounded-lg bg-primary py-2 text-xs font-semibold text-primary-foreground">Buy now · 🪙 {listing.buy_now_price.toLocaleString()}</button>}
        {!mine && listing.sol_lamports != null && (connected ? <button disabled={busy === listing.id} onClick={() => void buySol(listing)} className="w-full rounded-lg bg-violet-600 py-2 text-xs font-semibold text-white">Buy now · ◎ {(listing.sol_lamports/LAMPORTS_PER_SOL).toFixed(3)}</button> : <WalletButtons wallets={wallets} connecting={connecting} onConnect={connectWallet}/>) }
        {mine && <button disabled={busy === listing.id || Boolean(listing.high_bidder_id)} onClick={() => void cancel(listing)} className="w-full rounded-lg border border-border py-2 text-xs disabled:opacity-40">{listing.high_bidder_id ? "Cannot cancel after a bid" : "Cancel listing"}</button>}
        <div className="text-[10px] text-muted-foreground">Ends {new Date(listing.expires_at).toLocaleString()}</div>
      </div></article>;
    })}</div>}
  </div>;
}
function WalletButtons({ wallets, connecting, onConnect }: { wallets: ReturnType<typeof useWallet>["wallets"]; connecting: boolean; onConnect: (name: string) => void }) { return <div className="grid gap-1">{wallets.slice(0,2).map((w) => <button key={w.adapter.name} disabled={connecting} onClick={() => onConnect(w.adapter.name)} className="rounded-lg border border-violet-500/40 bg-violet-500/10 px-2 py-2 text-xs">Connect {w.adapter.name}</button>)}</div>; }
function Empty({ text }: { text: string }) { return <div className="rounded-2xl border border-dashed border-border/70 p-10 text-center text-sm text-muted-foreground">{text}</div>; }
