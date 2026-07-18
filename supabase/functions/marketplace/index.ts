import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function requiredEnv(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing server configuration: ${name}`);
  return value;
}

function isAddress(value: unknown): value is string {
  return typeof value === "string" && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value);
}

function isSignature(value: unknown): value is string {
  return typeof value === "string" && /^[1-9A-HJ-NP-Za-km-z]{80,90}$/.test(value);
}

async function getTransaction(rpcUrl: string, signature: string) {
  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "getTransaction",
      params: [signature, {
        encoding: "jsonParsed",
        commitment: "confirmed",
        maxSupportedTransactionVersion: 0,
      }],
    }),
  });
  if (!response.ok) throw new Error("Solana RPC request failed");
  const payload = await response.json();
  if (payload.error) throw new Error(payload.error.message ?? "Solana RPC returned an error");
  return payload.result;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const supabaseUrl = requiredEnv("SUPABASE_URL");
    const serviceRoleKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
    const rpcUrl = Deno.env.get("SOLANA_RPC_URL") || "https://api.devnet.solana.com";
    const token = (request.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "Sign in required" }, 401);

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: authData, error: authError } = await admin.auth.getUser(token);
    if (authError || !authData.user) return json({ error: "Invalid session" }, 401);

    const body = await request.json();
    if (body?.action === "create-sol") {
      const listingId = body.listingId;
      const buyerWallet = body.buyerWallet;
      if (typeof listingId !== "string" || !isAddress(buyerWallet)) {
        return json({ error: "Invalid listing or buyer wallet" }, 400);
      }
      const { data: listing, error } = await admin
        .from("market_listings")
        .select("*")
        .eq("id", listingId)
        .eq("status", "active")
        .single();
      if (error || !listing) return json({ error: "Listing not found" }, 404);
      if (listing.currency !== "sol" || listing.sale_type !== "buy_now") {
        return json({ error: "Listing is not available for SOL" }, 400);
      }
      if (listing.seller_id === authData.user.id) return json({ error: "You cannot buy your own card" }, 400);
      if (!isAddress(listing.seller_wallet) || buyerWallet === listing.seller_wallet) {
        return json({ error: "Buyer and seller wallets must be different" }, 400);
      }
      if (new Date(listing.expires_at).getTime() <= Date.now()) {
        return json({ error: "Listing has expired" }, 410);
      }

      await admin
        .from("market_sol_purchases")
        .update({ status: "expired" })
        .eq("listing_id", listing.id)
        .eq("status", "pending")
        .lte("expires_at", new Date().toISOString());

      const { data: existing } = await admin
        .from("market_sol_purchases")
        .select("id, buyer_id, buyer_wallet, expected_lamports, seller_wallet, expires_at")
        .eq("listing_id", listing.id)
        .eq("status", "pending")
        .gt("expires_at", new Date().toISOString())
        .maybeSingle();

      if (existing) {
        if (existing.buyer_id !== authData.user.id || existing.buyer_wallet !== buyerWallet) {
          return json({ error: "Another buyer is currently completing this purchase" }, 409);
        }
        return json({
          status: "pending",
          purchaseId: existing.id,
          expectedLamports: existing.expected_lamports,
          sellerWallet: existing.seller_wallet,
          expiresAt: existing.expires_at,
          memo: `gridiron-market:${existing.id}`,
        });
      }

      const { data: purchase, error: insertError } = await admin
        .from("market_sol_purchases")
        .insert({
          listing_id: listing.id,
          buyer_id: authData.user.id,
          buyer_wallet: buyerWallet,
          seller_wallet: listing.seller_wallet,
          expected_lamports: listing.sol_lamports,
        })
        .select("id, expected_lamports, seller_wallet, expires_at")
        .single();
      if (insertError?.code === "23505") {
        return json({ error: "Another buyer is currently completing this purchase" }, 409);
      }
      if (insertError) throw insertError;
      return json({
        status: "pending",
        purchaseId: purchase.id,
        expectedLamports: purchase.expected_lamports,
        sellerWallet: purchase.seller_wallet,
        expiresAt: purchase.expires_at,
        memo: `gridiron-market:${purchase.id}`,
      });
    }

    if (body?.action === "verify-sol") {
      const purchaseId = body.purchaseId;
      const signature = body.signature;
      if (typeof purchaseId !== "string" || !isSignature(signature)) {
        return json({ error: "Invalid purchase or signature" }, 400);
      }
      const { data: purchase, error } = await admin
        .from("market_sol_purchases")
        .select("*")
        .eq("id", purchaseId)
        .eq("buyer_id", authData.user.id)
        .single();
      if (error || !purchase) return json({ error: "Purchase not found" }, 404);
      if (purchase.status === "confirmed") {
        if (purchase.signature !== signature) return json({ error: "Purchase already finalized" }, 409);
        const { data: listing } = await admin.from("market_listings").select("card_data").eq("id", purchase.listing_id).single();
        return json({ status: "confirmed", card: listing?.card_data, signature });
      }
      if (purchase.status !== "pending" || new Date(purchase.expires_at).getTime() <= Date.now()) {
        return json({ error: "Purchase is not active" }, 410);
      }
      if (purchase.buyer_wallet === purchase.seller_wallet) {
        return json({ error: "Self-payments cannot purchase cards" }, 400);
      }
      const transaction = await getTransaction(rpcUrl, signature);
      if (!transaction) return json({ status: "confirming" });
      if (transaction.meta?.err) return json({ error: "Transaction failed on Solana" }, 400);
      const instructions = transaction.transaction?.message?.instructions ?? [];
      const memo = `gridiron-market:${purchase.id}`;
      const memoMatches = instructions.some((i: Record<string, unknown>) => i.program === "spl-memo" && i.parsed === memo);
      if (!memoMatches) return json({ error: "Transaction listing reference is missing" }, 400);
      const transferMatches = instructions.some((i: Record<string, unknown>) => {
        const parsed = i.parsed as { type?: string; info?: Record<string, unknown> } | undefined;
        const info = parsed?.info;
        return i.program === "system" && parsed?.type === "transfer"
          && info?.source === purchase.buyer_wallet
          && info?.destination === purchase.seller_wallet
          && Number(info?.lamports) === Number(purchase.expected_lamports);
      });
      if (!transferMatches) return json({ error: "Transaction does not match the listing payment" }, 400);
      const { data: card, error: finalizeError } = await admin.rpc("finalize_market_sol_purchase", {
        p_purchase_id: purchase.id,
        p_buyer_id: authData.user.id,
        p_signature: signature,
      });
      if (finalizeError) throw finalizeError;
      return json({ status: "confirmed", card, signature });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (error) {
    console.error(error);
    return json({ error: error instanceof Error ? error.message : "Unexpected server error" }, 500);
  }
});
