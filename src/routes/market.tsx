import { Buffer } from "buffer";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import {
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { PlayerCard } from "@/components/PlayerCard";
import { useAuth } from "@/hooks/useAuth";
import { refreshAuthoritativeState, setMarketCoinBalance, useGame } from "@/lib/game/store";
import type { Position } from "@/lib/game/types";
import {
  bootstrapMarketAccount,
  browseMarket,
  buyMarketListingCoins,
  cancelMarketListing,
  createSolMarketIntent,
  getMyMarketActivity,
  placeMarketBid,
  settleExpiredMarketListings,
  verifySolMarketPurchase,
  type MarketActivity,
  type MarketActivityItem,
  type MarketListing,
} from "@/lib/marketplace";
import { SolanaWalletProvider } from "@/lib/solana/WalletProvider";

export const Route = createFileRoute("/market")({
  component: MarketPage,
  head: () => ({ meta: [{ title: "Auction House — Gridiron Gainz" }] }),
});
type View = "browse" | "mine";
type Sort = "newest" | "name" | "position" | "overall_desc" | "overall_asc";
type Filters = {
  name: string;
  position: Position | "ALL";
  minOverall: string;
  maxOverall: string;
  sort: Sort;
};
const EMPTY_FILTERS: Filters = {
  name: "",
  position: "ALL",
  minOverall: "",
  maxOverall: "",
  sort: "newest",
};
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
  const { connection } = useConnection();
  const { wallets, publicKey, connected, connecting, select, connect, sendTransaction } =
    useWallet();
  const [view, setView] = useState<View>("browse");
  const [listings, setListings] = useState<MarketListing[]>([]);
  const [activity, setActivity] = useState<MarketActivity>({ items: [], heldCoins: 0 });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [bids, setBids] = useState<Record<string, string>>({});
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [filterOpen, setFilterOpen] = useState(false);
  const refresh = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      await settleExpiredMarketListings();
      const [market, balance, myActivity] = await Promise.all([
        browseMarket(),
        bootstrapMarketAccount(),
        getMyMarketActivity(),
        refreshAuthoritativeState(),
      ]);
      setListings(market);
      setActivity(myActivity);
      setMarketCoinBalance(balance);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load the auction house");
    } finally {
      setLoading(false);
    }
  }, [user?.id]);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  async function connectWallet(name: string) {
    try {
      select(name as never);
      setTimeout(() => connect().catch((e) => toast.error(e?.message ?? "Connect failed")), 50);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Connect failed");
    }
  }
  async function bid(l: MarketListing) {
    const min = Math.max(l.starting_price ?? 1, (l.current_bid ?? 0) + 1),
      amount = Number(bids[l.id] || min);
    setBusy(l.id);
    try {
      const r = await placeMarketBid(l.id, amount);
      setMarketCoinBalance(Number(r.balance));
      toast.success(`Bid placed: 🪙 ${amount.toLocaleString()}`);
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Bid failed");
    } finally {
      setBusy(null);
    }
  }
  async function buyCoins(l: MarketListing) {
    setBusy(l.id);
    try {
      const r = await buyMarketListingCoins(l.id);
      setMarketCoinBalance(r.balance);
      toast.success(`${r.card.name} joined your roster`);
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Purchase failed");
    } finally {
      setBusy(null);
    }
  }
  async function buySol(l: MarketListing) {
    if (!publicKey) return toast.error("Connect a buyer wallet first");
    setBusy(l.id);
    try {
      const i = await createSolMarketIntent(l.id, publicKey.toBase58()),
        seller = new PublicKey(i.sellerWallet);
      if (publicKey.equals(seller)) throw new Error("Buyer and seller wallets must be different");
      const memo = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr"),
        tx = new Transaction().add(
          SystemProgram.transfer({
            fromPubkey: publicKey,
            toPubkey: seller,
            lamports: i.expectedLamports,
          }),
          new TransactionInstruction({
            keys: [],
            programId: memo,
            data: Buffer.from(i.memo, "utf8") as never,
          }),
        );
      const latest = await connection.getLatestBlockhash("confirmed");
      tx.recentBlockhash = latest.blockhash;
      tx.feePayer = publicKey;
      const sig = await sendTransaction(tx, connection);
      toast.loading("Verifying devnet SOL payment…", { id: sig });
      await connection.confirmTransaction({ signature: sig, ...latest }, "confirmed");
      const done = await verifySolMarketPurchase(i.purchaseId, sig);
      if (!done.card) throw new Error("Card settlement did not complete");
      toast.success(`${done.card.name} joined your roster`, { id: sig });
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "SOL purchase failed");
    } finally {
      setBusy(null);
    }
  }
  async function cancel(l: MarketListing) {
    setBusy(l.id);
    try {
      await cancelMarketListing(l.id);
      toast.success("Listing cancelled and card returned");
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not cancel listing");
    } finally {
      setBusy(null);
    }
  }
  const shown = useMemo(() => applyFilters(listings, filters), [listings, filters]);
  const activeCount = filterCount(filters);
  return (
    <div className="animate-float-up space-y-5 pb-24">
      <header className="flex flex-col items-stretch gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-[.3em] text-primary/80">Player Market</div>
          <h1 className="mt-1 font-display text-3xl">Auction House</h1>
          <p className="text-sm text-muted-foreground">
            Find cards, track bids, and review every market result.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <Summary label="Available" value={`🪙 ${Math.floor(state.coins).toLocaleString()}`} />
          <Summary label="Held in bids" value={`🪙 ${activity.heldCoins.toLocaleString()}`} />
        </div>
      </header>
      <div className="rounded-lg border border-sky-500/30 bg-sky-500/10 px-3 py-2 text-xs text-sky-100">
        SOL purchases use devnet only. Completing either Buy Now option automatically refunds the
        active coin bidder.
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex min-w-0 flex-[1_0_100%] rounded-xl border border-border/70 bg-card/70 p-1 sm:flex-1 sm:basis-auto">
          {(["browse", "mine"] as View[]).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`flex-1 rounded-lg px-3 py-2 text-xs font-semibold uppercase tracking-wider ${view === v ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
            >
              {v === "browse" ? "Browse Market" : "My Auctions"}
            </button>
          ))}
        </div>
        {view === "browse" && (
          <button
            onClick={() => setFilterOpen(true)}
            className="min-w-0 flex-1 rounded-xl border border-primary/40 bg-card px-3 py-3 text-xs font-semibold sm:flex-none sm:px-4"
          >
            ⌕ Search & Filter{activeCount ? ` (${activeCount})` : ""}
          </button>
        )}
        <button
          onClick={() => void refresh()}
          className="rounded-xl border border-border bg-card px-3 py-3 text-xs"
        >
          ↻
        </button>
      </div>
      {view === "browse" ? (
        <>
          {activeCount > 0 && (
            <div className="flex items-center justify-between rounded-lg bg-card/60 px-3 py-2 text-xs">
              <span>
                {shown.length} result{shown.length === 1 ? "" : "s"} with filters applied
              </span>
              <button onClick={() => setFilters(EMPTY_FILTERS)} className="text-primary">
                Clear filters
              </button>
            </div>
          )}
          {loading ? (
            <Empty text="Loading live listings…" />
          ) : shown.length === 0 ? (
            <Empty text="No active listings match those filters." />
          ) : (
            <div className="grid grid-cols-2 gap-2 min-[420px]:gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {shown.map((l) => (
                <ListingCard
                  key={l.id}
                  listing={l}
                  mine={l.seller_id === user?.id}
                  busy={busy === l.id}
                  bidValue={bids[l.id]}
                  onBidValue={(v) => setBids((o) => ({ ...o, [l.id]: v }))}
                  onBid={() => void bid(l)}
                  onCoin={() => void buyCoins(l)}
                  onSol={() => void buySol(l)}
                  onCancel={() => void cancel(l)}
                  connected={connected}
                  wallets={wallets}
                  connecting={connecting}
                  onConnect={connectWallet}
                />
              ))}
            </div>
          )}
        </>
      ) : (
        <MyAuctions
          activity={activity}
          userId={user?.id ?? ""}
          loading={loading}
          onCancel={(l) => void cancel(l)}
          busy={busy}
        />
      )}
      {filterOpen && (
        <FilterScreen
          current={filters}
          onClose={() => setFilterOpen(false)}
          onApply={(f) => {
            setFilters(f);
            setFilterOpen(false);
          }}
        />
      )}
    </div>
  );
}

function ListingCard({
  listing: l,
  mine,
  busy,
  bidValue,
  onBidValue,
  onBid,
  onCoin,
  onSol,
  onCancel,
  connected,
  wallets,
  connecting,
  onConnect,
}: {
  listing: MarketListing;
  mine: boolean;
  busy: boolean;
  bidValue?: string;
  onBidValue: (v: string) => void;
  onBid: () => void;
  onCoin: () => void;
  onSol: () => void;
  onCancel: () => void;
  connected: boolean;
  wallets: ReturnType<typeof useWallet>["wallets"];
  connecting: boolean;
  onConnect: (n: string) => void;
}) {
  const min = Math.max(l.starting_price ?? 1, (l.current_bid ?? 0) + 1);
  return (
    <article className="rounded-xl border border-border/70 bg-card/75 p-2">
      <PlayerCard player={l.card_data} />
      <div className="mt-2 space-y-2">
        {l.starting_price != null && (
          <div className="rounded-lg border border-border p-2">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">
                {l.current_bid ? "Current bid" : "Starting bid"}
              </span>
              <b>🪙 {(l.current_bid ?? l.starting_price).toLocaleString()}</b>
            </div>
            {!mine && (
              <div className="mt-2 flex gap-1">
                <input
                  type="number"
                  min={min}
                  value={bidValue ?? min}
                  onChange={(e) => onBidValue(e.target.value)}
                  className="min-w-0 flex-1 rounded-md border border-border bg-background px-2 text-xs"
                />
                <button
                  disabled={busy}
                  onClick={onBid}
                  className="rounded-md bg-primary px-2 py-2 text-xs font-semibold text-primary-foreground"
                >
                  Bid
                </button>
              </div>
            )}
          </div>
        )}
        {!mine && l.buy_now_price != null && (
          <button
            disabled={busy}
            onClick={onCoin}
            className="w-full rounded-lg bg-primary py-2 text-xs font-semibold text-primary-foreground"
          >
            Buy now · 🪙 {l.buy_now_price.toLocaleString()}
          </button>
        )}
        {!mine &&
          l.sol_lamports != null &&
          (connected ? (
            <button
              disabled={busy}
              onClick={onSol}
              className="w-full rounded-lg bg-violet-600 py-2 text-xs font-semibold text-white"
            >
              Buy now · ◎ {(l.sol_lamports / LAMPORTS_PER_SOL).toFixed(3)}
            </button>
          ) : (
            <WalletButtons wallets={wallets} connecting={connecting} onConnect={onConnect} />
          ))}
        {mine && (
          <button
            disabled={busy || Boolean(l.high_bidder_id)}
            onClick={onCancel}
            className="w-full rounded-lg border border-border py-2 text-xs disabled:opacity-40"
          >
            {l.high_bidder_id ? "Cannot cancel after a bid" : "Cancel listing"}
          </button>
        )}
        <div className="text-[10px] text-muted-foreground">
          Ends {new Date(l.expires_at).toLocaleString()}
        </div>
      </div>
    </article>
  );
}

function MyAuctions({
  activity,
  userId,
  loading,
  onCancel,
  busy,
}: {
  activity: MarketActivity;
  userId: string;
  loading: boolean;
  onCancel: (l: MarketListing) => void;
  busy: string | null;
}) {
  const counts = {
    active: activity.items.filter(
      (i) => i.listing.seller_id === userId && i.listing.status === "active",
    ).length,
    winning: activity.items.filter(
      (i) => i.listing.status === "active" && i.listing.high_bidder_id === userId,
    ).length,
    outbid: activity.items.filter(
      (i) => i.myHighestBid && i.listing.status === "active" && i.listing.high_bidder_id !== userId,
    ).length,
    complete: activity.items.filter((i) => i.listing.status !== "active").length,
  };
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Summary label="Active listings" value={String(counts.active)} />
        <Summary label="Winning bids" value={String(counts.winning)} />
        <Summary label="Outbid" value={String(counts.outbid)} />
        <Summary label="Completed" value={String(counts.complete)} />
      </div>
      {loading ? (
        <Empty text="Loading your auction history…" />
      ) : activity.items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center">
          <div className="font-display text-2xl">No auction activity yet</div>
          <p className="mt-1 text-sm text-muted-foreground">
            List a bench player from Team → Roster or place your first bid.
          </p>
          <Link
            to="/roster"
            className="mt-4 inline-block rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
          >
            Manage roster
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {activity.items.map((item) => (
            <ActivityRow
              key={item.listing.id}
              item={item}
              userId={userId}
              busy={busy === item.listing.id}
              onCancel={() => onCancel(item.listing)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
function ActivityRow({
  item,
  userId,
  busy,
  onCancel,
}: {
  item: MarketActivityItem;
  userId: string;
  busy: boolean;
  onCancel: () => void;
}) {
  const l = item.listing,
    info = activityLabel(item, userId);
  return (
    <article className="grid grid-cols-[60px_minmax(0,1fr)] items-center gap-2 rounded-xl border border-border/70 bg-card/75 p-2 sm:grid-cols-[74px_1fr_auto] sm:gap-3">
      <div className="w-[60px] sm:w-[74px]">
        <PlayerCard player={l.card_data} compact onClick={() => {}} />
      </div>
      <div className="min-w-0">
        <div className="truncate font-display text-lg">{l.card_data.name}</div>
        <div className="text-xs text-muted-foreground">
          {l.card_data.position} · {l.card_data.overall} OVR
        </div>
        <div className="mt-1 text-xs">{marketPriceSummary(l, item.myHighestBid)}</div>
        <div className="text-[10px] text-muted-foreground">
          {new Date(l.completed_at ?? l.expires_at).toLocaleString()}
        </div>
      </div>
      <div className="col-span-2 flex items-center justify-end gap-3 text-right sm:col-span-1 sm:block">
        <div
          className={`rounded-full border px-2 py-1 text-[10px] font-semibold uppercase ${info.className}`}
        >
          {info.label}
        </div>
        {l.seller_id === userId && l.status === "active" && !l.high_bidder_id && (
          <button
            disabled={busy}
            onClick={onCancel}
            className="mt-2 text-xs text-muted-foreground hover:text-foreground"
          >
            Cancel
          </button>
        )}
      </div>
    </article>
  );
}
function activityLabel(item: MarketActivityItem, userId: string) {
  const l = item.listing;
  if (l.seller_id === userId) {
    if (l.status === "active") return badge("Active listing", "border-sky-500/40 text-sky-300");
    if (l.status === "sold") return badge("Sold", "border-emerald-500/40 text-emerald-300");
    if (l.status === "cancelled") return badge("Cancelled", "border-border text-muted-foreground");
    return badge("Expired", "border-border text-muted-foreground");
  }
  if (l.buyer_id === userId)
    return badge(
      l.current_bid && l.high_bidder_id === userId ? "Won" : "Purchased",
      "border-emerald-500/40 text-emerald-300",
    );
  if (l.status === "active" && l.high_bidder_id === userId)
    return badge("Winning", "border-primary/50 text-primary");
  if (l.status === "active") return badge("Outbid", "border-red-500/40 text-red-300");
  return badge("Bid refunded", "border-violet-500/40 text-violet-300");
}
function badge(label: string, className: string) {
  return { label, className };
}
function marketPriceSummary(l: MarketListing, myBid: number | null) {
  if (l.seller_id && l.status === "sold")
    return l.current_bid
      ? `Final bid 🪙 ${l.current_bid.toLocaleString()}`
      : l.buy_now_price
        ? `Coin Buy Now 🪙 ${l.buy_now_price.toLocaleString()}`
        : `SOL Buy Now ◎ ${((l.sol_lamports ?? 0) / LAMPORTS_PER_SOL).toFixed(3)}`;
  return myBid
    ? `Your highest bid 🪙 ${myBid.toLocaleString()}`
    : [
        l.starting_price && `Bid 🪙 ${l.starting_price.toLocaleString()}`,
        l.buy_now_price && `Buy 🪙 ${l.buy_now_price.toLocaleString()}`,
        l.sol_lamports && `◎ ${(l.sol_lamports / LAMPORTS_PER_SOL).toFixed(3)}`,
      ]
        .filter(Boolean)
        .join(" · ");
}

function FilterScreen({
  current,
  onClose,
  onApply,
}: {
  current: Filters;
  onClose: () => void;
  onApply: (f: Filters) => void;
}) {
  const [draft, setDraft] = useState(current);
  const inputClass =
    "w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary";
  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-background/95 p-2.5 backdrop-blur-xl sm:p-4"
      onClick={onClose}
    >
      <div
        className="mx-auto mt-2 max-w-lg rounded-2xl border border-border bg-card p-4 shadow-2xl sm:mt-8 sm:p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-[.25em] text-primary">
              Auction search
            </div>
            <h2 className="font-display text-3xl">Search & Filter</h2>
          </div>
          <button onClick={onClose} className="text-2xl text-muted-foreground">
            ×
          </button>
        </div>
        <div className="mt-5 space-y-4">
          <Field label="Player name">
            <input
              autoFocus
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              placeholder="Search any player…"
              className={inputClass}
            />
          </Field>
          <Field label="Position">
            <select
              value={draft.position}
              onChange={(e) =>
                setDraft({ ...draft, position: e.target.value as Filters["position"] })
              }
              className={inputClass}
            >
              <option value="ALL">All positions</option>
              {(["QB", "RB", "WR", "TE", "OL", "DL", "LB", "DB", "K", "P"] as Position[]).map(
                (p) => (
                  <option key={p}>{p}</option>
                ),
              )}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Minimum overall">
              <input
                type="number"
                min="60"
                max="86"
                value={draft.minOverall}
                onChange={(e) => setDraft({ ...draft, minOverall: e.target.value })}
                placeholder="60"
                className={inputClass}
              />
            </Field>
            <Field label="Maximum overall">
              <input
                type="number"
                min="60"
                max="86"
                value={draft.maxOverall}
                onChange={(e) => setDraft({ ...draft, maxOverall: e.target.value })}
                placeholder="86"
                className={inputClass}
              />
            </Field>
          </div>
          <Field label="Sort results">
            <select
              value={draft.sort}
              onChange={(e) => setDraft({ ...draft, sort: e.target.value as Sort })}
              className={inputClass}
            >
              <option value="newest">Newest listings</option>
              <option value="name">Name A–Z</option>
              <option value="position">Position</option>
              <option value="overall_desc">Overall: highest first</option>
              <option value="overall_asc">Overall: lowest first</option>
            </select>
          </Field>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-2">
          <button
            onClick={() => setDraft(EMPTY_FILTERS)}
            className="rounded-lg border border-border py-2.5 text-sm"
          >
            Reset
          </button>
          <button
            onClick={() => onApply(draft)}
            className="rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground"
          >
            Show results
          </button>
        </div>
      </div>
    </div>
  );
}
function applyFilters(rows: MarketListing[], f: Filters) {
  const q = f.name.trim().toLowerCase(),
    min = Number(f.minOverall) || 0,
    max = Number(f.maxOverall) || 999;
  return rows
    .filter(
      (l) =>
        (!q || l.card_data.name.toLowerCase().includes(q)) &&
        (f.position === "ALL" || l.card_data.position === f.position) &&
        l.card_data.overall >= min &&
        l.card_data.overall <= max,
    )
    .sort((a, b) =>
      f.sort === "name"
        ? a.card_data.name.localeCompare(b.card_data.name)
        : f.sort === "position"
          ? a.card_data.position.localeCompare(b.card_data.position) ||
            b.card_data.overall - a.card_data.overall
          : f.sort === "overall_desc"
            ? b.card_data.overall - a.card_data.overall
            : f.sort === "overall_asc"
              ? a.card_data.overall - b.card_data.overall
              : new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
}
function filterCount(f: Filters) {
  return (
    Number(Boolean(f.name)) +
    Number(f.position !== "ALL") +
    Number(Boolean(f.minOverall)) +
    Number(Boolean(f.maxOverall)) +
    Number(f.sort !== "newest")
  );
}
function WalletButtons({
  wallets,
  connecting,
  onConnect,
}: {
  wallets: ReturnType<typeof useWallet>["wallets"];
  connecting: boolean;
  onConnect: (n: string) => void;
}) {
  return (
    <div className="grid gap-1">
      {wallets.slice(0, 2).map((w) => (
        <button
          key={w.adapter.name}
          disabled={connecting}
          onClick={() => onConnect(w.adapter.name)}
          className="rounded-lg border border-violet-500/40 bg-violet-500/10 px-2 py-2 text-xs"
        >
          Connect {w.adapter.name}
        </button>
      ))}
    </div>
  );
}
function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/70 bg-card/80 px-3 py-2 text-center">
      <div className="text-[9px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="font-display text-xl text-gradient-gold">{value}</div>
    </div>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] uppercase tracking-widest text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}
function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border/70 p-10 text-center text-sm text-muted-foreground">
      {text}
    </div>
  );
}
