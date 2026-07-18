import { useSyncExternalStore } from "react";
import { COIN_PER_FAN_PER_HOUR, GRIDIRON_CASH_PER_SOL, LINEUP_SLOTS, computeFanValue, rarityFromOverall, type GameState, type Player, type Position, type Rarity } from "./types";
import { canonicalName, makeSignatureAttr, SIGNATURES } from "./generate";
import { seasonInfo } from "./season";

const RARITY_SELL_PRICE: Record<Rarity, number> = {
  bronze: 100,
  silver: 200,
  gold: 500,
  elite: 1_000,
};

export function sellPrice(p: Player): number {
  return RARITY_SELL_PRICE[p.rarity];
}

const BASE_KEY = "faf.state.v3";
let currentUserId: string | null = null;

function storageKey(uid: string | null): string {
  return uid ? `${BASE_KEY}:${uid}` : `${BASE_KEY}:guest`;
}

function activeStarterFans(roster: Player[], lineup: GameState["lineup"]): number {
  const starterIds = new Set(Object.values(lineup).filter((id): id is string => Boolean(id)));
  return roster.reduce((total, player) => total + (starterIds.has(player.id) ? player.fanValue : 0), 0);
}

const initialState = (): GameState => ({
  coins: 500,
  gridironCash: 0,
  currentPrizePoolSol: 250,
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

let state: GameState = load(null);
const listeners = new Set<() => void>();

function load(uid: string | null): GameState {
  if (typeof window === "undefined") return initialState();
  try {
    // Migrate legacy save on first load
    const legacy = localStorage.getItem(BASE_KEY);
    if (legacy && !localStorage.getItem(storageKey(uid))) {
      localStorage.setItem(storageKey(uid), legacy);
      localStorage.removeItem(BASE_KEY);
    }
    const raw = localStorage.getItem(storageKey(uid));
    if (!raw) return { ...initialState(), userId: uid };
    const parsed = JSON.parse(raw) as GameState;
    const merged = { ...initialState(), ...parsed, userId: uid };
    // Backfill popularity + recompute fanValue for legacy saves,
    // clamp overall to current cap, and remap legacy rarities.
    merged.roster = merged.roster.map((p) => {
      // Signature players are canonical: snap every copy to the registry stats.
      const sig = SIGNATURES.find((s) => s.name === p.name);
      if (sig) {
        return {
          ...p,
          name: sig.name,
          position: sig.position,
          rarity: sig.rarity,
          overall: sig.overall,
          strength: sig.strength,
          speed: sig.speed,
          iq: sig.iq,
          popularity: sig.popularity,
          fanValue: computeFanValue(sig.overall, sig.popularity, sig.rarity),
          signature: makeSignatureAttr(sig.position, sig.overall, sig.overall),
        };
      }

      const overall = Math.min(86, Math.max(60, p.overall));
      const strength = Math.min(99, p.strength);
      const speed = Math.min(99, p.speed);
      const iq = Math.min(99, p.iq);
      const popularity = typeof p.popularity === "number"
        ? p.popularity
        : Math.max(30, Math.min(99, Math.round(overall * 0.7 + (p.fanValue ?? 0) * 0.1)));
      const rarity = rarityFromOverall(overall);
      const canonical = canonicalName(rarity, p.position);
      const name = (rarity === "gold" || rarity === "elite") && p.name && !p.name.startsWith("Unsigned")
        ? p.name
        : canonical;
      return {
        ...p,
        overall,
        strength,
        speed,
        iq,
        popularity,
        rarity,
        fanValue: computeFanValue(overall, popularity, rarity),
        name,
        signature: p.signature ?? makeSignatureAttr(p.position, overall, overall),

      };
    });

    // Migrate legacy position-keyed lineups to slot-id keys and reshape
    // for the new offense (QB / RB / FLEX / WR1 / WR2 / TE / OL, no K on offense).
    const freshLineup = Object.fromEntries(LINEUP_SLOTS.map((s) => [s, null])) as GameState["lineup"];
    const legacyMap: Record<string, string> = {
      WR: "WR1", DL: "DL", LB: "LB1", DB: "DB1",
      RB1: "RB", RB2: "FLEX", // v2 -> v3 offense reshape
    };
    for (const [k, v] of Object.entries(merged.lineup ?? {})) {
      if (!v) continue;
      const defenseMap: Record<string, string> = { DL1: "DL", DB3: "DB3", DFLEX: "DFLEX" };
      const target = LINEUP_SLOTS.includes(k) ? k : (defenseMap[k] ?? legacyMap[k] ?? k);
      if (LINEUP_SLOTS.includes(target) && freshLineup[target] == null) {
        freshLineup[target] = v;
      }
    }
    merged.lineup = freshLineup;
    merged.fans = activeStarterFans(merged.roster, merged.lineup);

    return merged;
  } catch {
    return { ...initialState(), userId: uid };
  }
}

function persist() {
  if (typeof window === "undefined") return;
  localStorage.setItem(storageKey(currentUserId), JSON.stringify(state));
}

export function setStoreUser(uid: string | null) {
  if (currentUserId === uid) return;
  currentUserId = uid;
  state = load(uid);
  listeners.forEach((l) => l());
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
    packsOpened: s.packsOpened + 1,
  }));
}

function removePlayerInternal(s: GameState, id: string): GameState {
  if (!s.roster.some((r) => r.id === id)) return s;
  const nextLineup = { ...s.lineup };
  for (const pos of LINEUP_SLOTS) if (nextLineup[pos] === id) nextLineup[pos] = null;
  const nextRoster = s.roster.filter((r) => r.id !== id);
  return {
    ...s,
    roster: nextRoster,
    fans: activeStarterFans(nextRoster, nextLineup),
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

export function spendGridironCash(amount: number): boolean {
  if ((state.gridironCash ?? 0) < amount) return false;
  set((s) => ({ ...s, gridironCash: (s.gridironCash ?? 0) - amount }));
  return true;
}

export function creditGridironCashPurchase(sol: number, signature?: string): number {
  if (!Number.isFinite(sol) || sol <= 0) return 0;
  const cash = Math.round(sol * GRIDIRON_CASH_PER_SOL);
  const currentPoolSol = sol * 0.6;
  const nextPoolSol = sol * 0.2;
  const devSol = sol * 0.2;
  set((s) => ({
    ...s,
    sol: (s.sol ?? 0) + sol,
    gridironCash: (s.gridironCash ?? 0) + cash,
    currentPrizePoolSol: (s.currentPrizePoolSol ?? 250) + currentPoolSol,
    nextSeasonPoolSol: (s.nextSeasonPoolSol ?? 0) + nextPoolSol,
    devTreasurySol: (s.devTreasurySol ?? 0) + devSol,
    cashPurchases: [{
      id: signature ?? `mock-${Date.now()}`,
      createdAt: Date.now(),
      sol,
      cash,
      currentPoolSol,
      nextPoolSol,
      devSol,
      signature,
    }, ...(s.cashPurchases ?? [])].slice(0, 50),
  }));
  return cash;
}

export function setLineup(slot: string, playerId: string | null) {
  set((s) => {
    const next = { ...s.lineup };
    // clear any slot currently holding this player
    if (playerId) {
      for (const p of LINEUP_SLOTS) if (next[p] === playerId) next[p] = null;
    }
    next[slot] = playerId;
    return { ...s, lineup: next, fans: activeStarterFans(s.roster, next) };
  });
}

export function recordResult(win: boolean, pointsFor = 0, pointsAgainst = 0, opponentName = "Opponent"): boolean {
  const info = seasonInfo();
  const gameKey = `${info.seasonNumber}:${info.dayOfSeason}`;
  if ((state.officialGameKeys ?? []).includes(gameKey)) return false;
  set((s) => ({
    ...s,
    wins: s.wins + (!info.isPlayoffs && win ? 1 : 0),
    losses: s.losses + (!info.isPlayoffs && !win ? 1 : 0),
    pointsFor: (s.pointsFor ?? 0) + (!info.isPlayoffs ? pointsFor : 0),
    pointsAgainst: (s.pointsAgainst ?? 0) + (!info.isPlayoffs ? pointsAgainst : 0),
    officialGameKeys: [...(s.officialGameKeys ?? []), gameKey],
    officialResults: [...(s.officialResults ?? []), {
      key: gameKey,
      seasonNumber: info.seasonNumber,
      dayOfSeason: info.dayOfSeason,
      win,
      pointsFor,
      pointsAgainst,
      opponentName,
    }],
    coins: s.coins + (win ? 150 : 40),
  }));
  return true;
}

export function resetAll() {
  state = { ...initialState(), userId: currentUserId };
  persist();
  listeners.forEach((l) => l());
}

export function openStarterPack(players: Player[]) {
  set((s) => ({
    ...s,
    roster: [...s.roster, ...players],
    starterPackOpened: true,
  }));
}

export function devGrantCoins(amount: number) {
  set((s) => ({ ...s, coins: s.coins + amount }));
}

export function setTeamName(name: string) {
  const clean = name.trim().slice(0, 24);
  set((s) => ({ ...s, teamName: clean || undefined }));
}

export function addSol(amount: number) {
  set((s) => ({ ...s, sol: (s.sol ?? 0) + amount }));
}

export function setWalletAddress(addr: string | null) {
  set((s) => ({ ...s, walletAddress: addr ?? undefined }));
}

/* No auto-collect: coins must be manually claimed via claimCoins(). */
