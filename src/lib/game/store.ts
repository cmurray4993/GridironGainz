import { useSyncExternalStore } from "react";
import {
  COIN_PER_FAN_PER_HOUR,
  LINEUP_SLOTS,
  type GameState,
  type Player,
  type Rarity,
} from "./types";
import {
  bootstrapAuthoritativeGame,
  claimFanCoins,
  fetchAuthoritativeSnapshot,
  openAuthoritativePack,
  saveAuthoritativeLineup,
  saveAuthoritativeTeamName,
  snapshotToGameState,
} from "./authoritative";

const RARITY_SELL_PRICE: Record<Rarity, number> = {
  bronze: 100,
  silver: 200,
  gold: 500,
  elite: 1_000,
};

export function sellPrice(p: Player): number {
  return RARITY_SELL_PRICE[p.rarity];
}

let currentUserId: string | null = null;
let hydrationVersion = 0;

const initialState = (): GameState => ({
  coins: 0,
  gridironCash: 0,
  currentPrizePoolSol: 0,
  nextSeasonPoolSol: 0,
  devTreasurySol: 0,
  cashPurchases: [],
  fans: 0,
  roster: [],
  lineup: Object.fromEntries(LINEUP_SLOTS.map((p) => [p, null])) as GameState["lineup"],
  lastTick: Date.now(),
  packsOpened: 0,
  wins: 0,
  losses: 0,
  pointsFor: 0,
  pointsAgainst: 0,
  officialGameKeys: [],
  officialResults: [],
  starterPackOpened: false,
  userId: null,
});

let state: GameState = initialState();
const listeners = new Set<() => void>();

function load(uid: string | null): GameState {
  return { ...initialState(), userId: uid };
}

function persist() {
  // Intentionally empty. Supabase is the only durable source of game state.
}

export function setStoreUser(uid: string | null) {
  if (currentUserId === uid) return;
  currentUserId = uid;
  state = load(uid);
  listeners.forEach((l) => l());
  const version = ++hydrationVersion;
  if (uid) {
    void bootstrapAuthoritativeGame()
      .then((snapshot) => {
        if (currentUserId !== uid || hydrationVersion !== version) return;
        state = snapshotToGameState(snapshot, uid);
        listeners.forEach((l) => l());
      })
      .catch((error) => console.error("Authoritative game bootstrap failed", error));
  }
}

export async function refreshAuthoritativeState() {
  const uid = currentUserId;
  if (!uid) return state;
  const snapshot = await fetchAuthoritativeSnapshot();
  if (currentUserId === uid) {
    state = snapshotToGameState(snapshot, uid);
    listeners.forEach((l) => l());
  }
  return state;
}

function set(updater: (s: GameState) => GameState) {
  state = updater(state);
  persist();
  listeners.forEach((l) => l());
}

export function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function getState() {
  return state;
}
function serverSnapshot() {
  return initialState();
}

export function useGame(): GameState {
  return useSyncExternalStore(subscribe, getState, serverSnapshot);
}

/* ---------- passive claim system ----------
 * Coins accumulate in 15-minute buckets from `lastTick` (last claim time).
 * Cap: 8 hours (32 buckets). Anything beyond the cap is lost on claim so
 * players are nudged to log back in and collect.
 */
export const CLAIM_BUCKET_MS = 15 * 60 * 1000;
export const MAX_CLAIM_BUCKETS = 32; // 8 hours

export interface PendingClaim {
  buckets: number; // full 15-min buckets ready to claim (0-32)
  coins: number; // coins those buckets are worth
  msToNextBucket: number; // ms until the next bucket ticks
  cappedBuckets: boolean; // true if we're at the 8h cap
  msSinceClaim: number;
}

export function pendingClaim(): PendingClaim {
  const now = Date.now();
  const elapsed = Math.max(0, now - state.lastTick);
  const rawBuckets = Math.floor(elapsed / CLAIM_BUCKET_MS);
  const buckets = Math.min(rawBuckets, MAX_CLAIM_BUCKETS);
  const coinsPerBucket = state.fans * COIN_PER_FAN_PER_HOUR * 0.25;
  return {
    buckets,
    coins: buckets * coinsPerBucket,
    msToNextBucket:
      buckets >= MAX_CLAIM_BUCKETS ? 0 : CLAIM_BUCKET_MS - (elapsed % CLAIM_BUCKET_MS),
    cappedBuckets: rawBuckets >= MAX_CLAIM_BUCKETS,
    msSinceClaim: elapsed,
  };
}

export async function claimCoins(): Promise<number> {
  const result = await claimFanCoins(crypto.randomUUID());
  await refreshAuthoritativeState();
  return Number(result.coins ?? 0);
}

export function setMarketCoinBalance(coins: number) {
  if (!Number.isFinite(coins) || coins < 0) return;
  set((s) => ({ ...s, coins }));
}

export function syncGridironCashSnapshot(snapshot: {
  account: { balance: number };
  purchases: Array<{
    id: string;
    signature: string | null;
    expected_lamports: number;
    gc_amount: number;
    current_pool_lamports: number;
    next_pool_lamports: number;
    development_lamports: number;
    created_at: string;
  }>;
  allocation: {
    current_pool_lamports: number;
    next_pool_lamports: number;
    development_lamports: number;
  } | null;
}) {
  const lamportsPerSol = 1_000_000_000;
  const purchases = snapshot.purchases.map((purchase) => ({
    id: purchase.id,
    createdAt: new Date(purchase.created_at).getTime(),
    sol: purchase.expected_lamports / lamportsPerSol,
    cash: purchase.gc_amount,
    currentPoolSol: purchase.current_pool_lamports / lamportsPerSol,
    nextPoolSol: purchase.next_pool_lamports / lamportsPerSol,
    devSol: purchase.development_lamports / lamportsPerSol,
    signature: purchase.signature ?? undefined,
  }));
  set((s) => ({
    ...s,
    gridironCash: Number(snapshot.account.balance ?? 0),
    sol: purchases.reduce((sum, purchase) => sum + purchase.sol, 0),
    // Purchases are intentionally separate from competitive rewards in beta.
    currentPrizePoolSol: 0,
    nextSeasonPoolSol: 0,
    devTreasurySol: 0,
    cashPurchases: purchases,
  }));
}

export function setGridironCashBalance(balance: number) {
  if (!Number.isFinite(balance) || balance < 0) return;
  set((s) => ({ ...s, gridironCash: balance }));
}

export async function setLineup(slot: string, playerId: string | null) {
  await saveAuthoritativeLineup(slot, playerId);
  await refreshAuthoritativeState();
}

export async function openStarterPack(_players?: Player[]) {
  const result = await openAuthoritativePack("starter", "free", crypto.randomUUID());
  await refreshAuthoritativeState();
  return result.cards;
}

export async function setTeamName(name: string) {
  await saveAuthoritativeTeamName(name);
  await refreshAuthoritativeState();
}

export function setWalletAddress(addr: string | null) {
  set((s) => ({ ...s, walletAddress: addr ?? undefined }));
}

/* No auto-collect: coins must be manually claimed via claimCoins(). */
