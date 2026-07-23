import { supabase } from "@/integrations/supabase/client";
import type { Database, Json } from "@/integrations/supabase/types";
import type { Player } from "@/lib/game/types";

type ListingRow = Database["public"]["Tables"]["market_listings"]["Row"];

async function untypedRpc<T>(name: string, params: Record<string, unknown> = {}) {
  const { data, error } = await (
    supabase.rpc as unknown as (
      fn: string,
      args?: Record<string, unknown>,
    ) => Promise<{ data: T | null; error: { message: string } | null }>
  )(name, params);
  if (error) throw new Error(error.message);
  return data;
}

export interface MarketListing extends Omit<ListingRow, "card_data"> {
  card_data: Player;
}

export interface MarketActivityItem {
  listing: MarketListing;
  myHighestBid: number | null;
}

export interface MarketActivity {
  items: MarketActivityItem[];
  heldCoins: number;
}

export interface ListingDraft {
  startingPrice?: number;
  buyNowPrice?: number;
  solLamports?: number;
  sellerWallet?: string;
  durationHours: number;
}

export const MARKET_PRICE_FLOORS = {
  bronze: { startingBid: 250, coinBuyNow: 1_000 },
  silver: { startingBid: 500, coinBuyNow: 2_500 },
  gold: { startingBid: 1_500, coinBuyNow: 7_500 },
  elite: { startingBid: 5_000, coinBuyNow: 20_000 },
} as const;

export const MIN_SOL_LAMPORTS = 10_000_000;
export const MAX_SOL_LAMPORTS = 100_000_000_000;

export async function bootstrapMarketAccount() {
  const { data, error } = await supabase.rpc("bootstrap_market_account", {
    // Kept only for compatibility with the old RPC signature. The server
    // ignores this value and reads the authoritative economy account.
    p_starting_coins: 0,
  });
  if (error) throw error;
  return Number(data ?? 0);
}

export async function browseMarket(): Promise<MarketListing[]> {
  const { data, error } = await supabase
    .from("market_listings")
    .select("*")
    .eq("status", "active")
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => ({ ...row, card_data: row.card_data as unknown as Player }));
}

export async function getMyMarketActivity(): Promise<MarketActivity> {
  const data = await untypedRpc<unknown>("get_my_market_activity");
  const payload = (data ?? {}) as unknown as {
    items?: Array<{
      listing: ListingRow & { buyer_id?: string | null };
      myHighestBid?: number | null;
    }>;
    heldCoins?: number;
  };
  return {
    items: (payload.items ?? []).map((item) => ({
      listing: { ...item.listing, card_data: item.listing.card_data as unknown as Player },
      myHighestBid: item.myHighestBid == null ? null : Number(item.myHighestBid),
    })),
    heldCoins: Number(payload.heldCoins ?? 0),
  };
}

export async function settleExpiredMarketListings() {
  const { data, error } = await supabase.rpc("settle_expired_market_listings");
  if (error) throw error;
  return Number(data ?? 0);
}

export async function createMarketListing(player: Player, draft: ListingDraft) {
  const hasCoins = Boolean(draft.startingPrice || draft.buyNowPrice);
  const { data, error } = await supabase.rpc("create_market_listing", {
    // Attributes are loaded from player_cards by the server.
    p_card_data: { id: player.id } as unknown as Json,
    p_currency: hasCoins ? "coins" : "sol",
    p_sale_type: draft.startingPrice ? "auction" : "buy_now",
    p_starting_price: draft.startingPrice,
    p_buy_now_price: draft.buyNowPrice,
    p_sol_lamports: draft.solLamports,
    p_seller_wallet: draft.sellerWallet,
    p_duration_hours: draft.durationHours,
  });
  if (error) throw error;
  return { ...data, card_data: data.card_data as unknown as Player } as MarketListing;
}

export async function quickSellMarketCard(cardId: string) {
  const data = await untypedRpc<unknown>("quick_sell_market_card", { p_card_id: cardId });
  return data as unknown as { handled: boolean; price?: number; balance?: number };
}

export async function placeMarketBid(listingId: string, amount: number) {
  const { data, error } = await supabase.rpc("place_market_bid", {
    p_listing_id: listingId,
    p_amount: Math.floor(amount),
  });
  if (error) throw error;
  return data[0];
}

export async function buyMarketListingCoins(listingId: string) {
  const { data, error } = await supabase.rpc("buy_market_listing_coins", {
    p_listing_id: listingId,
  });
  if (error) throw error;
  const result = data[0];
  return { balance: Number(result.balance), card: result.card_data as unknown as Player };
}

export async function cancelMarketListing(listingId: string) {
  const { data, error } = await supabase.rpc("cancel_market_listing", {
    p_listing_id: listingId,
  });
  if (error) throw error;
  return data as unknown as Player;
}

async function invoke<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("marketplace", { body });
  if (error) {
    let message = error.message;
    const context = (error as { context?: Response }).context;
    if (context) {
      try {
        const payload = await context.clone().json();
        if (typeof payload?.error === "string") message = payload.error;
      } catch {
        // Preserve the original Supabase error.
      }
    }
    throw new Error(message);
  }
  if (data?.error) throw new Error(data.error);
  return data as T;
}

export interface SolMarketIntent {
  status: "pending";
  purchaseId: string;
  expectedLamports: number;
  sellerWallet: string;
  expiresAt: string;
  memo: string;
}

export function createSolMarketIntent(listingId: string, buyerWallet: string) {
  return invoke<SolMarketIntent>({ action: "create-sol", listingId, buyerWallet });
}

export async function verifySolMarketPurchase(purchaseId: string, signature: string) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const result = await invoke<{
      status: "confirming" | "confirmed";
      card?: Player;
      signature?: string;
    }>({
      action: "verify-sol",
      purchaseId,
      signature,
    });
    if (result.status === "confirmed" && result.card) return result;
    await new Promise((resolve) => setTimeout(resolve, 1_500));
  }
  throw new Error("The SOL payment is confirmed but card settlement is still processing.");
}
