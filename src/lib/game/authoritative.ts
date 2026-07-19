import { supabase } from "@/integrations/supabase/client";
import type { AuthoritativeState, GameState, Player, Position } from "./types";

export type PackCode = "starter" | "standard" | "position" | "pro" | "backyard";
export type PackCurrency = "free" | "coins" | "gc";

type SnapshotPayload = {
  account: {
    coins: number;
    fans: number;
    last_claim_at: string;
    gridiron_cash: number;
    team_name: string;
    level: number;
    xp: number;
    packs_opened: number;
    starter_pack_opened: boolean;
    lifetime_wins: number;
    lifetime_losses: number;
  };
  roster: Player[];
  lineup: Record<string, string | null>;
  season: AuthoritativeState["season"];
  team: AuthoritativeState["team"];
  standings: AuthoritativeState["standings"];
  games: AuthoritativeState["games"];
  rewards: AuthoritativeState["rewards"];
  pendingClaim: AuthoritativeState["pendingClaim"];
};

type PackOpeningPayload = {
  openingId: string;
  duplicate: boolean;
  cards: Player[];
  odds: Record<string, unknown>;
};

export interface PackDefinition {
  code: PackCode;
  display_name: string;
  version: number;
  coin_cost: number | null;
  gc_cost: number | null;
  card_count: number;
  odds: {
    description?: string;
    signatureChance?: number;
    slots?: Array<Record<string, number>>;
  };
}

async function rpc<T>(name: string, params: Record<string, unknown> = {}): Promise<T> {
  // Generated Supabase types are refreshed after migrations are deployed.
  // Keeping the cast here lets this commit and its migration ship together.
  const { data, error } = await (
    supabase.rpc as unknown as (
      fn: string,
      args?: Record<string, unknown>,
    ) => Promise<{ data: T | null; error: { message: string } | null }>
  )(name, params);
  if (error) throw new Error(error.message);
  if (data == null) throw new Error(`${name} returned no data`);
  return data;
}

function asNumber(value: unknown, fallback = 0): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export function snapshotToGameState(payload: SnapshotPayload, userId: string): GameState {
  const finals = payload.games.filter(
    (game) =>
      game.status === "final" &&
      (game.home_team_id === payload.team.id || game.away_team_id === payload.team.id),
  );
  return {
    userId,
    coins: asNumber(payload.account.coins),
    gridironCash: asNumber(payload.account.gridiron_cash),
    fans: asNumber(payload.account.fans),
    roster: payload.roster ?? [],
    lineup: payload.lineup ?? {},
    lastTick: new Date(payload.account.last_claim_at).getTime(),
    packsOpened: asNumber(payload.account.packs_opened),
    starterPackOpened: Boolean(payload.account.starter_pack_opened),
    teamName: payload.account.team_name,
    wins: asNumber(payload.team?.wins),
    losses: asNumber(payload.team?.losses),
    pointsFor: asNumber(payload.team?.points_for),
    pointsAgainst: asNumber(payload.team?.points_against),
    officialGameKeys: finals.map((game) => `${payload.season.number}:${game.day_number}`),
    officialResults: finals.map((game) => {
      const home = game.home_team_id === payload.team.id;
      const opponentId = home ? game.away_team_id : game.home_team_id;
      const opponent = payload.standings.find((team) => team.id === opponentId);
      const pointsFor = asNumber(home ? game.home_score : game.away_score);
      const pointsAgainst = asNumber(home ? game.away_score : game.home_score);
      return {
        key: `${payload.season.number}:${game.day_number}`,
        seasonNumber: payload.season.number,
        dayOfSeason: game.day_number,
        win: game.winner_team_id === payload.team.id,
        pointsFor,
        pointsAgainst,
        opponentName: opponent?.name ?? "Opponent",
      };
    }),
    authoritative: {
      season: payload.season,
      team: payload.team,
      standings: payload.standings ?? [],
      games: payload.games ?? [],
      rewards: payload.rewards ?? [],
      pendingClaim: payload.pendingClaim,
    },
  };
}

export function bootstrapAuthoritativeGame() {
  return rpc<SnapshotPayload>("bootstrap_game_account");
}

export function fetchAuthoritativeSnapshot() {
  return rpc<SnapshotPayload>("get_game_snapshot");
}

export function claimFanCoins(requestId: string) {
  return rpc<{ coins: number; balance: number; duplicate: boolean }>("claim_fan_coins", {
    p_request_id: requestId,
  });
}

export function saveAuthoritativeLineup(slot: string, cardId: string | null) {
  return rpc<{ slot: string; cardId: string | null; fans: number }>("set_authoritative_lineup", {
    p_slot: slot,
    p_card_id: cardId,
  });
}

export function saveAuthoritativeTeamName(name: string) {
  return rpc<string>("set_authoritative_team_name", { p_name: name });
}

export function openAuthoritativePack(
  code: PackCode,
  currency: PackCurrency,
  requestId: string,
  position?: Position,
) {
  return rpc<PackOpeningPayload>("open_authoritative_pack", {
    p_pack_code: code,
    p_currency: currency,
    p_request_id: requestId,
    p_position: position ?? null,
  });
}

export async function fetchPackDefinitions(): Promise<PackDefinition[]> {
  const { data, error } = await supabase
    .from("pack_definitions" as never)
    .select("code,display_name,version,coin_cost,gc_cost,card_count,odds")
    .eq("active", true)
    .order("coin_cost", { ascending: true, nullsFirst: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as PackDefinition[];
}

export function fetchTodayOfficialGame() {
  return rpc<{
    game: AuthoritativeState["games"][number];
    opponent: AuthoritativeState["standings"][number];
    opponentTopPlayers: Player[];
    isHome: boolean;
  } | null>("get_today_official_game");
}
