import { useWallet } from "@solana/wallet-adapter-react";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { PlayerCard } from "@/components/PlayerCard";
import { removeMarketPlayer, sellPlayer, sellPrice, setMarketCoinBalance, useGame } from "@/lib/game/store";
import { createMarketListing, MARKET_PRICE_FLOORS, MAX_SOL_LAMPORTS, MIN_SOL_LAMPORTS, quickSellMarketCard } from "@/lib/marketplace";
import { SolanaWalletProvider } from "@/lib/solana/WalletProvider";

export const Route = createFileRoute("/player/$playerId")({ component: PlayerPage, head: () => ({ meta: [{ title: "Player — Gridiron Gainz" }] }) });
function PlayerPage() { return <SolanaWalletProvider><PlayerManager /></SolanaWalletProvider>; }

function PlayerManager() {
  const { playerId } = Route.useParams(); const navigate = useNavigate(); const state = useGame();
  const { wallets, publicKey, connected, connecting, select, connect } = useWallet();
  const player = state.roster.find((p) => p.id === playerId); const starter = Object.values(state.lineup).includes(playerId);
  const floors = player ? MARKET_PRICE_FLOORS[player.rarity] : MARKET_PRICE_FLOORS.bronze;
  const [auctionOn, setAuctionOn] = useState(true); const [coinOn, setCoinOn] = useState(true); const [solOn, setSolOn] = useState(false);
  const [startingBid, setStartingBid] = useState(String(floors.startingBid)); const [coinBuy, setCoinBuy] = useState(String(floors.coinBuyNow));
  const [solBuy, setSolBuy] = useState("0.05"); const [duration, setDuration] = useState("24"); const [busy, setBusy] = useState(false);
  const validation = useMemo(() => {
    if (!auctionOn && !coinOn && !solOn) return "Enable at least one sale option";
    if (auctionOn && Number(startingBid) < floors.startingBid) return `Minimum starting bid is ${floors.startingBid.toLocaleString()} coins`;
    if (coinOn && Number(coinBuy) < floors.coinBuyNow) return `Minimum coin Buy Now is ${floors.coinBuyNow.toLocaleString()} coins`;
    if (auctionOn && coinOn && Number(coinBuy) <= Number(startingBid)) return "Coin Buy Now must be greater than the starting bid";
    if (solOn && (Number(solBuy) < MIN_SOL_LAMPORTS/LAMPORTS_PER_SOL || Number(solBuy) > MAX_SOL_LAMPORTS/LAMPORTS_PER_SOL)) return "SOL Buy Now must be between 0.01 and 100 SOL";
    if (solOn && !publicKey) return "Connect a seller wallet for the SOL option";
    return null;
  }, [auctionOn, coinOn, solOn, startingBid, coinBuy, solBuy, floors, publicKey]);
  if (!player) return <div className="py-20 text-center"><h1 className="font-display text-3xl">Player not found</h1><button onClick={() => navigate({to:"/roster"})} className="mt-4 rounded-lg bg-primary px-4 py-2 text-primary-foreground">Back to roster</button></div>;
  async function connectWallet(name: string) { try { select(name as never); setTimeout(() => connect().catch((e) => toast.error(e?.message ?? "Connect failed")), 50); } catch (e) { toast.error(e instanceof Error ? e.message : "Connect failed"); } }
  async function quickSell() { if (starter) return; setBusy(true); try { const server = await quickSellMarketCard(player.id); if (server.handled) { removeMarketPlayer(player.id); if (server.balance != null) setMarketCoinBalance(server.balance); } else sellPlayer(player.id); toast.success(`${player.name} quick-sold for ${server.price ?? sellPrice(player)} coins`); await navigate({to:"/roster"}); } catch (e) { toast.error(e instanceof Error ? e.message : "Quick sell failed"); } finally { setBusy(false); } }
  async function list() { if (starter || validation) return; setBusy(true); try { await createMarketListing(player, { startingPrice: auctionOn ? Math.floor(Number(startingBid)) : undefined, buyNowPrice: coinOn ? Math.floor(Number(coinBuy)) : undefined, solLamports: solOn ? Math.round(Number(solBuy)*LAMPORTS_PER_SOL) : undefined, sellerWallet: solOn ? publicKey?.toBase58() : undefined, durationHours: Number(duration) }); removeMarketPlayer(player.id); toast.success(`${player.name} is now in the Auction House`); await navigate({to:"/roster"}); } catch (e) { toast.error(e instanceof Error ? e.message : "Listing failed"); } finally { setBusy(false); } }
  return <div className="fixed inset-0 z-40 overflow-x-auto overflow-y-auto bg-[radial-gradient(circle_at_50%_25%,oklch(0.22_0.025_240),oklch(0.09_0.015_245)_62%)]">
    <div className="min-h-full min-w-[900px]"><header className="sticky top-0 z-10 flex items-center justify-between border-b border-white/10 bg-black/60 px-7 py-3 backdrop-blur-xl"><button onClick={() => navigate({to:"/roster"})} className="flex items-center gap-2 font-display text-3xl"><span className="text-4xl text-primary">‹</span>{player.position} PLAYER</button><div className="text-right"><div className="text-[10px] uppercase tracking-[.25em] text-muted-foreground">Roster management</div><div className="font-display text-xl">{starter ? "STARTING LINEUP" : "BENCH"}</div></div></header>
    <main className="mx-auto grid max-w-7xl grid-cols-[250px_minmax(320px,1fr)_330px] items-start gap-6 px-7 py-9">
      <section><div className="mb-2 text-center text-[10px] uppercase tracking-[.25em] text-primary">Your card</div><PlayerCard player={player} onClick={() => {}}/></section>
      <section><div className="mb-4 text-center font-display text-4xl text-gradient-gold">{player.overall} <span className="text-xl text-foreground">OVR</span></div><div className="space-y-2"><Stat label="Strength" value={player.strength}/><Stat label="Speed" value={player.speed}/><Stat label="IQ" value={player.iq}/><Stat label="Popularity" value={player.popularity}/><Stat label="Fan Value" value={player.fanValue}/><Stat label={player.signature.label} value={player.signature.value}/></div><button disabled={starter||busy} onClick={() => void quickSell()} className="mt-5 w-full rounded-lg border border-destructive/50 bg-destructive/10 py-2.5 font-semibold text-destructive disabled:opacity-40">{starter ? "Remove from lineup to quick sell" : `Quick sell · 🪙 ${sellPrice(player)}`}</button></section>
      <aside className="rounded-2xl border border-white/10 bg-black/25 p-4"><h2 className="font-display text-2xl">Auction House Listing</h2><p className="mb-4 text-xs text-muted-foreground">Enable any combination. Each price is independent.</p>{starter ? <div className="rounded-lg border border-primary/30 bg-primary/10 p-4 text-sm">Remove this player from the starting lineup before listing.</div> : <>
        <Option checked={auctionOn} onChange={setAuctionOn} label="Coin starting bid"><Price disabled={!auctionOn} value={startingBid} onChange={setStartingBid} suffix={`min ${floors.startingBid.toLocaleString()}`}/></Option>
        <Option checked={coinOn} onChange={setCoinOn} label="Coin Buy Now"><Price disabled={!coinOn} value={coinBuy} onChange={setCoinBuy} suffix={`min ${floors.coinBuyNow.toLocaleString()}`}/></Option>
        <Option checked={solOn} onChange={setSolOn} label="Devnet SOL Buy Now"><Price disabled={!solOn} value={solBuy} onChange={setSolBuy} step="0.01" suffix="0.01–100 SOL"/>{solOn && !connected && <div className="mt-2 grid gap-1">{wallets.slice(0,2).map((w) => <button key={w.adapter.name} disabled={connecting} onClick={() => void connectWallet(w.adapter.name)} className="rounded-lg border border-violet-500/40 px-2 py-2 text-xs">Connect {w.adapter.name}</button>)}</div>}</Option>
        <label className="mt-3 block text-[10px] uppercase tracking-widest text-muted-foreground">Listing duration</label><select value={duration} onChange={(e) => setDuration(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2"><option value="12">12 hours</option><option value="24">24 hours</option><option value="48">48 hours</option><option value="72">72 hours</option></select>
        {validation && <div className="mt-3 text-xs text-amber-300">{validation}</div>}<button disabled={busy||Boolean(validation)} onClick={() => void list()} className="mt-4 w-full rounded-lg bg-[image:var(--gradient-gold)] py-2.5 font-semibold text-primary-foreground disabled:opacity-40">{busy ? "Working…" : "List on Auction House"}</button>
      </>}</aside>
    </main></div></div>;
}
function Stat({label,value}:{label:string;value:number}) { return <div className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[.05] px-4 py-3"><span className="font-semibold">{label}</span><b className="font-display text-xl">{value.toLocaleString()}</b></div>; }
function Option({checked,onChange,label,children}:{checked:boolean;onChange:(v:boolean)=>void;label:string;children:React.ReactNode}) { return <div className="mb-3 rounded-lg border border-border/70 p-3"><label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={checked} onChange={(e)=>onChange(e.target.checked)}/>{label}</label><div className="mt-2">{children}</div></div>; }
function Price({value,onChange,disabled,suffix,step="1"}:{value:string;onChange:(v:string)=>void;disabled:boolean;suffix:string;step?:string}) { return <div><input type="number" min="0" step={step} disabled={disabled} value={value} onChange={(e)=>onChange(e.target.value)} className="w-full rounded-md border border-border bg-background px-3 py-2 disabled:opacity-40"/><div className="mt-1 text-[10px] text-muted-foreground">{suffix}</div></div>; }
