// Simple in-memory SOL/USD price cache (60s TTL).
let cache: { price: number; at: number } | null = null;
const TTL = 60_000;

export async function getSolUsd(): Promise<number> {
  if (cache && Date.now() - cache.at < TTL) return cache.price;
  try {
    const r = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd");
    const j = await r.json();
    const price = Number(j?.solana?.usd) || 0;
    cache = { price, at: Date.now() };
    return price;
  } catch {
    return cache?.price ?? 0;
  }
}
