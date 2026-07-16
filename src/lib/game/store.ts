import { useSyncExternalStore } from "react";
import { COIN_PER_FAN_PER_HOUR, LINEUP_SLOTS, type GameState, type Player, type Position, type Rarity } from "./types";

const RARITY_SELL_MULT: Record<Rarity, number> = {
  common: 0.8,
  uncommon: 1.4,
  rare: 2.4,
  epic: 4.2,
  legendary: 8,
};

export function sellPrice(p: Player): number {
  return Math.max(5, Math.round(p.overall * RARITY_SELL_MULT[p.rarity]));
}

const KEY = "faf.state.v1";

const initialState = (): GameState => ({
  coins: 500,
  fans: 0,
  roster: [],
  lineup: Object.fromEntries(LINEUP_SLOTS.map((p) => [p, null])) as GameState["lineup"],
  lastTick: Date.now(),
  packsOpened: 0,
  wins: 0,
  losses: 0,
});

let state: GameState = load();
const listeners = new Set<() => void>();

function load(): GameState {
  if (typeof window === "undefined") return initialState();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return initialState();
    const parsed = JSON.parse(raw) as GameState;
    return { ...initialState(), ...parsed };
  } catch {
    return initialState();
  }
}

function persist() {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(state));
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

export function getState() { return state; }
function serverSnapshot() { return initialState(); }

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
  buckets: number;         // full 15-min buckets ready to claim (0-32)
  coins: number;           // coins those buckets are worth
  msToNextBucket: number;  // ms until the next bucket ticks
  cappedBuckets: boolean;  // true if we're at the 8h cap
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

export function claimCoins(): number {
  const pend = pendingClaim();
  if (pend.buckets <= 0) return 0;
  const now = Date.now();
  set((s) => ({
    ...s,
    coins: s.coins + pend.coins,
    // Advance by the buckets we claimed so partial progress carries over.
    // If capped, snap to `now` so the 8h window restarts fresh.
    lastTick: pend.cappedBuckets ? now : s.lastTick + pend.buckets * CLAIM_BUCKET_MS,
  }));
  return pend.coins;
}


export function addPlayers(players: Player[]) {
  set((s) => ({
    ...s,
    roster: [...s.roster, ...players],
    fans: s.fans + players.reduce((a, p) => a + p.fanValue, 0),
    packsOpened: s.packsOpened + 1,
  }));
}

function removePlayerInternal(s: GameState, id: string): GameState {
  const p = s.roster.find((r) => r.id === id);
  if (!p) return s;
  const nextLineup = { ...s.lineup };
  for (const pos of LINEUP_SLOTS) if (nextLineup[pos] === id) nextLineup[pos] = null;
  return {
    ...s,
    roster: s.roster.filter((r) => r.id !== id),
    fans: Math.max(0, s.fans - p.fanValue),
    lineup: nextLineup,
  };
}

export function sellPlayer(id: string): number {
  const p = state.roster.find((r) => r.id === id);
  if (!p) return 0;
  const price = sellPrice(p);
  set((s) => {
    const next = removePlayerInternal(s, id);
    return { ...next, coins: next.coins + price };
  });
  return price;
}

export function discardPlayer(id: string) {
  set((s) => removePlayerInternal(s, id));
}



export function spendCoins(amount: number): boolean {
  if (state.coins < amount) return false;
  set((s) => ({ ...s, coins: s.coins - amount }));
  return true;
}

export function setLineup(position: Position, playerId: string | null) {
  set((s) => {
    const next = { ...s.lineup };
    // clear any slot currently holding this player
    if (playerId) {
      for (const p of LINEUP_SLOTS) if (next[p] === playerId) next[p] = null;
    }
    next[position] = playerId;
    return { ...s, lineup: next };
  });
}

export function recordResult(win: boolean) {
  set((s) => ({
    ...s,
    wins: s.wins + (win ? 1 : 0),
    losses: s.losses + (win ? 0 : 1),
    coins: s.coins + (win ? 150 : 40),
    fans: s.fans + (win ? 25 : 5),
  }));
}

export function resetAll() {
  state = initialState();
  persist();
  listeners.forEach((l) => l());
}

/* No auto-collect: coins must be manually claimed via claimCoins(). */
